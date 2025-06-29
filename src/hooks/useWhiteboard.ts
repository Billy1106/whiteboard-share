import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { WhiteboardManager, DrawingContext, DrawingTool } from '@/whiteboard';

interface UseWhiteboardProps {
  sessionId: string;
  userId: string;
}

export function useWhiteboard({ sessionId, userId }: UseWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const whiteboardManagerRef = useRef<WhiteboardManager | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fabricLib, setFabricLib] = useState<any>(null);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [drawingColor, setDrawingColorState] = useState('#000000');
  const [drawingWidth, setDrawingWidthState] = useState(5);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Fabric.jsを動的にインポート
  useEffect(() => {
    if (typeof window !== 'undefined' && !fabricLib) {
      import('fabric').then(module => {
        setFabricLib(module);
      });
    }
  }, [fabricLib]);

  useEffect(() => {
    if (!canvasRef.current || !fabricLib) return;
    
    const canvasWidth = 1500;
    const canvasHeight = 800;
    
    // Canvas要素のサイズを設定
    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;
    canvasRef.current.style.width = `${canvasWidth}px`;
    canvasRef.current.style.height = `${canvasHeight}px`;
    
    // Fabric.jsキャンバスを作成
    const FabricCanvas = fabricLib.Canvas || fabricLib.default?.Canvas;
    const canvas = new FabricCanvas(canvasRef.current, {
      isDrawingMode: false,
      selection: false,
      width: canvasWidth,
      height: canvasHeight,
    });
    fabricCanvasRef.current = canvas;

    // WhiteboardManagerを初期化
    const context: DrawingContext = {
      canvas,
      sessionId,
      userId,
      fabricLib
    };
    
    const manager = new WhiteboardManager(context);
    whiteboardManagerRef.current = manager;

    // パス設定を共通化する関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configurePathObject = (pathObject: any, pathData: any) => {
      pathObject.set({
        fill: '',
        stroke: pathData.stroke || '#000000',
        strokeWidth: pathData.strokeWidth || 5
      });
    };

    // パスをキャンバスに追加する共通処理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addPathToCanvas = (pathObject: any, pathId: string, loadedPathIds: Set<string>) => {
      // FirebaseのIDをオブジェクトに保存
      (pathObject as fabric.Object & { firebaseId?: string }).firebaseId = pathId;
      canvas.add(pathObject);
      canvas.renderAll();
      loadedPathIds.add(pathId);
    };

    // ズーム機能を設定する関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setupZoomControls = (canvas: any) => {
      // マウスホイールでのズーム
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:wheel', (opt: any) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        
        // ズームレベルを0.1倍から5倍の間に制限
        if (zoom > 5) zoom = 5;
        if (zoom < 0.1) zoom = 0.1;
        
        // マウス位置を中心にズーム
        const pointer = canvas.getPointer(opt.e);
        canvas.zoomToPoint({ x: pointer.x, y: pointer.y }, zoom);
        
        // ズームレベルを更新
        setZoomLevel(zoom);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // タッチ（ピンチ）ズーム
      let isZooming = false;
      let lastDistance = 0;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('touch:gesture', (opt: any) => {
        if (opt.e.touches && opt.e.touches.length === 2) {
          const touch1 = opt.e.touches[0];
          const touch2 = opt.e.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          
          if (isZooming) {
            const scale = distance / lastDistance;
            let zoom = canvas.getZoom() * scale;
            
            if (zoom > 5) zoom = 5;
            if (zoom < 0.1) zoom = 0.1;
            
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            const rect = canvas.getElement().getBoundingClientRect();
            const pointer = {
              x: centerX - rect.left,
              y: centerY - rect.top
            };
            
            canvas.zoomToPoint(pointer, zoom);
            setZoomLevel(zoom);
          }
          
          lastDistance = distance;
          isZooming = true;
          opt.e.preventDefault();
        } else {
          isZooming = false;
        }
      });
      
      // Figmaスタイルのパンニング機能
      let isPanning = false;
      let lastPanX = 0;
      let lastPanY = 0;
      
      const startPanning = (evt: MouseEvent) => {
        isPanning = true;
        canvas.selection = false;
        lastPanX = evt.clientX;
        lastPanY = evt.clientY;
        canvas.defaultCursor = 'grabbing';
        canvas.renderAll();
      };
      
      const updatePanning = (evt: MouseEvent) => {
        if (isPanning) {
          const vpt = canvas.viewportTransform;
          vpt[4] += evt.clientX - lastPanX;
          vpt[5] += evt.clientY - lastPanY;
          canvas.requestRenderAll();
          lastPanX = evt.clientX;
          lastPanY = evt.clientY;
        }
      };
      
      const stopPanning = () => {
        isPanning = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.renderAll();
      };
      
      // パンニング機能の統合イベントハンドラ
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:down', (opt: any) => {
        const evt = opt.e;
        
        // 1. Ctrl/Cmd + クリック
        // 2. スペースキー + クリック  
        // 3. 中クリック
        // 4. handツールでのクリック
        if (evt.ctrlKey || evt.metaKey || isSpacePressed || evt.button === 1 || currentTool === 'hand') {
          startPanning(evt);
          opt.e.preventDefault();
          return;
        }
      });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:move', (opt: any) => {
        updatePanning(opt.e);
      });
      
      canvas.on('mouse:up', () => {
        stopPanning();
      });
    };

    // 描画設定を初期化
    setTimeout(() => {
      try {
        const FabricPencilBrush = fabricLib.PencilBrush || fabricLib.default?.PencilBrush;
        if (FabricPencilBrush) {
          canvas.freeDrawingBrush = new FabricPencilBrush(canvas);
          canvas.freeDrawingBrush.width = 5;
          canvas.freeDrawingBrush.color = '#000000';
        }
        
        // 初期設定をManagerに反映
        manager.setTool(currentTool);
        manager.setColor(drawingColor);
        manager.setWidth(drawingWidth);
        

        
        const canvasElement = canvas.getElement();
        if (canvasElement) {
          canvasElement.style.touchAction = 'none';
          canvasElement.style.border = '1px solid #ccc';
        }

        // ズーム機能の設定
        setupZoomControls(canvas);
        
        canvas.renderAll();
        setIsCanvasReady(true);
      } catch (error) {
        console.error('Canvas initialization error:', error);
      }
    }, 100);

    // Firebase同期設定
    const pathsRef = ref(db, `drawings/${sessionId}/paths`);
    const loadedPathIds = new Set<string>();
    
    // 読み取り専用プロパティを除去する関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanObjectData = (data: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleaned: any = { ...data };
      // 読み取り専用プロパティを除去
      delete cleaned.type;
      delete cleaned.version;
      delete cleaned.originX;
      delete cleaned.originY;
      return cleaned;
    };

    // オブジェクト復元の共通処理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restoreObject = (pathData: any, pathId: string) => {
      if (!pathId || !pathData || loadedPathIds.has(pathId)) return;
      
      try {
        let objectToAdd;
        
        if (pathData.type === 'path' || pathData.type === 'Path') {
          const FabricPath = fabricLib.Path || fabricLib.default?.Path;
          if (FabricPath.fromObject) {
            const pathObjectOrPromise = FabricPath.fromObject(pathData);
            
            if (pathObjectOrPromise instanceof Promise) {
              pathObjectOrPromise.then((pathObject) => {
                if (pathObject) {
                  configurePathObject(pathObject, pathData);
                  addPathToCanvas(pathObject, pathId, loadedPathIds);
                }
              }).catch(() => {
                const cleanedData = cleanObjectData(pathData);
                const pathObject = new FabricPath(pathData.path, cleanedData);
                configurePathObject(pathObject, pathData);
                addPathToCanvas(pathObject, pathId, loadedPathIds);
              });
              return;
            } else {
              objectToAdd = pathObjectOrPromise;
            }
          } else {
            const cleanedData = cleanObjectData(pathData);
            objectToAdd = new FabricPath(pathData.path, cleanedData);
          }
        } else if (pathData.type === 'rect' || pathData.type === 'Rect') {
          const FabricRect = fabricLib.Rect || fabricLib.default?.Rect;
          const cleanedData = cleanObjectData(pathData);
          objectToAdd = new FabricRect(cleanedData);
        } else if (pathData.type === 'circle' || pathData.type === 'Circle') {
          const FabricCircle = fabricLib.Circle || fabricLib.default?.Circle;
          const cleanedData = cleanObjectData(pathData);
          objectToAdd = new FabricCircle(cleanedData);
        } else if (pathData.type === 'line' || pathData.type === 'Line') {
          const FabricLine = fabricLib.Line || fabricLib.default?.Line;
          const cleanedData = cleanObjectData(pathData);
          objectToAdd = new FabricLine([pathData.x1, pathData.y1, pathData.x2, pathData.y2], cleanedData);
        } else if (pathData.type === 'i-text' || pathData.type === 'IText') {
          const FabricIText = fabricLib.IText || fabricLib.default?.IText;
          const cleanedData = cleanObjectData(pathData);
          objectToAdd = new FabricIText(pathData.text || '', cleanedData);
        }
        
        if (objectToAdd) {
          addPathToCanvas(objectToAdd, pathId, loadedPathIds);
        }
      } catch (error) {
        console.error('Object creation error for', pathId, ':', error);
      }
    };
    
    let isInitialLoad = true;
    
    // Firebase同期設定
    const unsubscribe = onValue(pathsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const firebaseObjectIds = Object.keys(data);
          
          if (isInitialLoad) {
            // 初回ロード時：すべてのデータを復元
            firebaseObjectIds.forEach((pathId) => {
              restoreObject(data[pathId], pathId);
            });
            canvas.renderAll();
            isInitialLoad = false;
          } else {
            // 通常の更新時：新しいオブジェクトを追加、削除されたオブジェクトを削除
            
            // 新しいオブジェクトを追加
            firebaseObjectIds.forEach((pathId) => {
              if (!loadedPathIds.has(pathId)) {
                restoreObject(data[pathId], pathId);
              }
            });
            
            // 削除されたオブジェクトをキャンバスから削除
            const canvasObjects = canvas.getObjects();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            canvasObjects.forEach((obj: any) => {
              const firebaseId = obj.get('firebaseId');
              if (firebaseId && !firebaseObjectIds.includes(firebaseId)) {
                canvas.remove(obj);
                loadedPathIds.delete(firebaseId);
              }
            });
            
            canvas.renderAll();
          }
        } else {
          // データが完全に削除された場合（全消去）
          if (!isInitialLoad) {
            canvas.clear();
            loadedPathIds.clear();
            canvas.renderAll();
          }
          isInitialLoad = false;
        }
      } catch (error) {
        console.error('Data sync error:', error);
      }
    });

    // マウスイベントハンドラー
    let isDown = false;
    // プレビューの開始位置を保存
    let startPoint: { x: number; y: number } | null = null;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', (opt: any) => {
      const evt = opt.e;
      const tool = currentTool;
      
      // パンニングが優先される場合は描画機能をスキップ
      if (evt.ctrlKey || evt.metaKey || isSpacePressed || evt.button === 1 || tool === 'hand') {
        return;
      }
      
      // ペンと消しゴムはfreeDrawingModeで処理されるのでスキップ
      if (['pen', 'eraser'].includes(tool)) {
        return;
      }
      
      if (!['rectangle', 'circle', 'line', 'text'].includes(tool)) {
        return;
      }
      
      isDown = true;
      const pointer = canvas.getPointer(opt.e);
      startPoint = pointer;
      
      if (tool === 'text') {
        manager.addText(pointer);
        return;
      }
      
      // 図形描画開始時にプレビューを開始
      if (['rectangle', 'circle', 'line'].includes(tool)) {
        manager.startPreview(pointer);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:move', (opt: any) => {
      if (!isDown || !startPoint) {
        return;
      }
      
      const pointer = canvas.getPointer(opt.e);
      
      if (manager.hasPreview()) {
        manager.updatePreview(startPoint, pointer);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:up', (opt: any) => {
      if (!isDown || !startPoint) {
        return;
      }
      
      isDown = false;
      const pointer = canvas.getPointer(opt.e);
      const tool = currentTool;
      
      if (manager.hasPreview() && ['rectangle', 'circle', 'line'].includes(tool)) {
        manager.endPreview();
        
        const distance = Math.max(Math.abs(pointer.x - startPoint.x), Math.abs(pointer.y - startPoint.y));
        
        if (distance > 3) {
          manager.drawShape(startPoint, pointer);
        }
      }
      
      startPoint = null;
    });

    // パス作成完了時の処理（コマンドパターンを使用）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('path:created', (e: any) => {
      if (!e.path) return;
      
      if (currentTool === 'eraser') {
        // 消しゴム機能をコマンドパターンで実行
        manager.eraseObjects(e.path);
        return;
      }
      
      if (currentTool === 'pen') {
        // ペン描画をコマンドパターンで実行

        
        // Fabricjsが自動的にキャンバスに追加したパスを一旦削除
        canvas.remove(e.path);
        
        // パスデータを準備
        e.path.set('fill', '');
        const pathData = e.path.toObject();
        
        // パスオブジェクトに一意のIDを生成・設定
        const objectId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        
        // コマンドパターンでペン描画を実行（再度キャンバスに追加される）
        manager.addPath(pathData, objectId);
      }
    });

    // キーボードイベントハンドラーを追加
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.defaultCursor = 'grab';
        }
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.defaultCursor = currentTool === 'hand' ? 'grab' : 'default';
        }
        e.preventDefault();
      }
    };

    // グローバルキーボードイベントを追加
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.dispose();
      unsubscribe();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [sessionId, userId, fabricLib, currentTool, drawingColor, drawingWidth]);

  // 色と線の太さの変更を処理
  useEffect(() => {
    if (whiteboardManagerRef.current) {
      whiteboardManagerRef.current.setColor(drawingColor);
      whiteboardManagerRef.current.setWidth(drawingWidth);
    }
  }, [drawingColor, drawingWidth]);

  // ツール変更
  const setTool = (tool: DrawingTool) => {
    setCurrentTool(tool);
    if (whiteboardManagerRef.current) {
      whiteboardManagerRef.current.setTool(tool);
    }
    
    // ツールに応じてカーソルを変更
    if (fabricCanvasRef.current) {
      if (tool === 'hand') {
        fabricCanvasRef.current.defaultCursor = 'grab';
        fabricCanvasRef.current.hoverCursor = 'grab';
      } else {
        fabricCanvasRef.current.defaultCursor = 'default';
        fabricCanvasRef.current.hoverCursor = 'move';
      }
    }
  };

  // 描画色を設定
  const setDrawingColor = (color: string) => {
    setDrawingColorState(color);
  };

  // 描画幅を設定
  const setDrawingWidth = (width: number) => {
    setDrawingWidthState(width);
  };

  // 全消去（コマンドパターンを使用）
  const clearCanvas = () => {
    if (whiteboardManagerRef.current) {
      whiteboardManagerRef.current.clearCanvas();
    }
  };

  // Undo機能（コマンドパターンを使用）
  const undo = () => {
    if (whiteboardManagerRef.current) {
      return whiteboardManagerRef.current.undo();
    }
    return false;
  };

  // Redo機能（新機能）
  const redo = () => {
    if (whiteboardManagerRef.current) {
      return whiteboardManagerRef.current.redo();
    }
    return false;
  };

  // ズームイン機能
  const zoomIn = () => {
    if (fabricCanvasRef.current) {
      let zoom = fabricCanvasRef.current.getZoom();
      zoom = zoom * 1.1;
      if (zoom > 5) zoom = 5;
      
      const center = {
        x: fabricCanvasRef.current.getWidth() / 2,
        y: fabricCanvasRef.current.getHeight() / 2
      };
      fabricCanvasRef.current.zoomToPoint(center, zoom);
      setZoomLevel(zoom);
    }
  };

  // ズームアウト機能
  const zoomOut = () => {
    if (fabricCanvasRef.current) {
      let zoom = fabricCanvasRef.current.getZoom();
      zoom = zoom * 0.9;
      if (zoom < 0.1) zoom = 0.1;
      
      const center = {
        x: fabricCanvasRef.current.getWidth() / 2,
        y: fabricCanvasRef.current.getHeight() / 2
      };
      fabricCanvasRef.current.zoomToPoint(center, zoom);
      setZoomLevel(zoom);
    }
  };

  // ズームリセット機能
  const resetZoom = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setZoom(1);
      fabricCanvasRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoomLevel(1);
    }
  };

  return { 
    canvasRef, 
    fabricCanvasRef, 
    isCanvasReady, 
    currentTool,
    drawingColor,
    drawingWidth,
    zoomLevel,
    setTool,
    setDrawingColor, 
    setDrawingWidth,
    clearCanvas,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom
  };
}
