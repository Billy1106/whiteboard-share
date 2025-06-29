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
    
    const canvasWidth = 800;
    const canvasHeight = 600;
    
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
      const tool = currentTool;
      
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

    return () => {
      canvas.dispose();
      unsubscribe();
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

  return { 
    canvasRef, 
    fabricCanvasRef, 
    isCanvasReady, 
    currentTool,
    drawingColor,
    drawingWidth,
    setTool,
    setDrawingColor, 
    setDrawingWidth,
    clearCanvas,
    undo,
    redo
  };
}
