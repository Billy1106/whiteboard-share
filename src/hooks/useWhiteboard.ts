import { useEffect, useRef, useState } from 'react';
import { ref, set, onValue, remove } from 'firebase/database';
import { db } from '@/lib/firebase';

export type DrawingTool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'select';

interface UseWhiteboardProps {
  sessionId: string;
  userId: string;
}

export function useWhiteboard({ sessionId, userId }: UseWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricCanvasRef = useRef<any>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fabricLib, setFabricLib] = useState<any>(null);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [drawingColor, setDrawingColorState] = useState('#000000');
  const [drawingWidth, setDrawingWidthState] = useState(5);

  
  // 最新の値を参照するためのref
  const currentColorRef = useRef(drawingColor);
  const currentWidthRef = useRef(drawingWidth);
  const currentToolRef = useRef(currentTool);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // refの値を更新
  useEffect(() => {
    currentColorRef.current = drawingColor;
    currentWidthRef.current = drawingWidth;
    currentToolRef.current = currentTool;
  }, [drawingColor, drawingWidth, currentTool]);

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
      pathObject.set('firebaseId', pathId);
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
        
        updateCanvasMode();
        
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

    // キャンバスモードを更新する関数
    const updateCanvasMode = () => {
      if (!canvas) return;
      
      switch (currentTool) {
        case 'pen':
          canvas.isDrawingMode = true;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          canvas.getElement().style.cursor = 'crosshair';
          break;
        case 'eraser':
          canvas.isDrawingMode = true;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          canvas.getElement().style.cursor = 'crosshair';
          break;
        case 'select':
          canvas.isDrawingMode = false;
          canvas.selection = true;
          canvas.skipTargetFind = false;
          canvas.getElement().style.cursor = 'default';
          break;
        default:
          canvas.isDrawingMode = false;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          canvas.getElement().style.cursor = 'crosshair';
          break;
      }
    };

    // ツール変更時にキャンバスモードを更新
    updateCanvasMode();

    // Firebase同期設定
    const pathsRef = ref(db, `drawings/${sessionId}/paths`);
    const loadedPathIds = new Set<string>();
    
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
                const pathObject = new FabricPath(pathData.path, pathData);
                configurePathObject(pathObject, pathData);
                addPathToCanvas(pathObject, pathId, loadedPathIds);
              });
              return;
            } else {
              objectToAdd = pathObjectOrPromise;
            }
          } else {
            objectToAdd = new FabricPath(pathData.path, pathData);
          }
        } else if (pathData.type === 'rect' || pathData.type === 'Rect') {
          const FabricRect = fabricLib.Rect || fabricLib.default?.Rect;
          objectToAdd = new FabricRect(pathData);
        } else if (pathData.type === 'circle' || pathData.type === 'Circle') {
          const FabricCircle = fabricLib.Circle || fabricLib.default?.Circle;
          objectToAdd = new FabricCircle(pathData);
        } else if (pathData.type === 'line' || pathData.type === 'Line') {
          const FabricLine = fabricLib.Line || fabricLib.default?.Line;
          objectToAdd = new FabricLine([pathData.x1, pathData.y1, pathData.x2, pathData.y2], pathData);
        } else if (pathData.type === 'i-text' || pathData.type === 'IText') {
          const FabricIText = fabricLib.IText || fabricLib.default?.IText;
          objectToAdd = new FabricIText(pathData.text, pathData);
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

    // プレビュー図形作成関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createPreviewShape = (start: any, tool: DrawingTool) => {
      let shape;
      
      switch (tool) {
        case 'rectangle':
          const FabricRect = fabricLib.Rect || fabricLib.default?.Rect;
          if (!FabricRect) return null;
          
          shape = new FabricRect({
            left: start.x - 10,
            top: start.y - 10,
            width: 20,
            height: 20,
            fill: 'transparent',
            stroke: currentColorRef.current,
            strokeWidth: Math.max(2, currentWidthRef.current),
            strokeDashArray: [8, 4],
            opacity: 0.7,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          break;
        case 'circle':
          const FabricCircle = fabricLib.Circle || fabricLib.default?.Circle;
          if (!FabricCircle) return null;
          
          shape = new FabricCircle({
            left: start.x - 10,
            top: start.y - 10,
            radius: 10,
            fill: 'transparent',
            stroke: currentColorRef.current,
            strokeWidth: Math.max(2, currentWidthRef.current),
            strokeDashArray: [8, 4], // より見やすい点線
            opacity: 0.7,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          break;
        case 'line':
          const FabricLine = fabricLib.Line || fabricLib.default?.Line;
          if (!FabricLine) return null;
          
          shape = new FabricLine([start.x, start.y, start.x + 20, start.y], {
            stroke: currentColorRef.current,
            strokeWidth: Math.max(2, currentWidthRef.current),
            strokeDashArray: [8, 4], // より見やすい点線
            opacity: 0.7,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          break;
      }
      
      return shape;
    };

    // プレビュー図形更新関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePreviewShape = (shape: any, start: any, end: any, tool: DrawingTool) => {
      switch (tool) {
        case 'rectangle':
          shape.set({
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            width: Math.max(3, Math.abs(end.x - start.x)),
            height: Math.max(3, Math.abs(end.y - start.y)),
          });
          break;
        case 'circle':
          const radius = Math.max(3, Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2);
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          shape.set({
            left: centerX - radius,
            top: centerY - radius,
            radius: radius,
          });
          break;
        case 'line':
          // 直線の場合は座標を直接設定
          shape.set({
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
          });
          break;
      }
    };

    // マウスイベントハンドラー
    let isDown = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentShape: any = null;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', (opt: any) => {
      const tool = currentToolRef.current;
      
      if (!['rectangle', 'circle', 'line', 'text'].includes(tool)) {
        return;
      }
      
      isDown = true;
      const pointer = canvas.getPointer(opt.e);
      startPointRef.current = pointer;
      
      if (tool === 'text') {
        addText(pointer.x, pointer.y);
        return;
      }
      
      // 図形描画開始時にプレビュー用の図形を作成
      if (['rectangle', 'circle', 'line'].includes(tool)) {
        currentShape = createPreviewShape(pointer, tool);
        
        if (currentShape) {
          canvas.add(currentShape);
          canvas.renderAll();
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:move', (opt: any) => {
      if (!isDown || !startPointRef.current || !currentShape) {
        return;
      }
      
      const pointer = canvas.getPointer(opt.e);
      const tool = currentToolRef.current;
      updatePreviewShape(currentShape, startPointRef.current, pointer, tool);
      canvas.renderAll();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:up', (opt: any) => {
      if (!isDown || !startPointRef.current) {
        return;
      }
      
      isDown = false;
      const pointer = canvas.getPointer(opt.e);
      const tool = currentToolRef.current;
      
      if (currentShape && ['rectangle', 'circle', 'line'].includes(tool)) {
        canvas.remove(currentShape);
        
        const distance = Math.max(Math.abs(pointer.x - startPointRef.current.x), Math.abs(pointer.y - startPointRef.current.y));
        
        if (distance > 3) {
          addShape(startPointRef.current, pointer, tool);
        }
        
        currentShape = null;
      }
      
      startPointRef.current = null;
    });

    // 図形追加関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addShape = (start: any, end: any, tool: DrawingTool) => {
      let shape;
      const timestamp = Date.now();
      const objectId = `${userId}_${timestamp}`;
      
      switch (tool) {
        case 'rectangle':
          const FabricRect = fabricLib.Rect || fabricLib.default?.Rect;
          const rectWidth = Math.max(5, Math.abs(end.x - start.x));
          const rectHeight = Math.max(5, Math.abs(end.y - start.y));
          
          if (!FabricRect) break;
          
          shape = new FabricRect({
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            width: rectWidth,
            height: rectHeight,
            fill: 'transparent',
            stroke: currentColorRef.current,
            strokeWidth: currentWidthRef.current,
          });
          break;
        case 'circle':
          const FabricCircle = fabricLib.Circle || fabricLib.default?.Circle;
          if (!FabricCircle) break;
          
          const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          shape = new FabricCircle({
            left: centerX - radius,
            top: centerY - radius,
            radius: radius,
            fill: 'transparent',
            stroke: currentColorRef.current,
            strokeWidth: currentWidthRef.current,
          });
          break;
        case 'line':
          const FabricLine = fabricLib.Line || fabricLib.default?.Line;
          if (!FabricLine) break;
          
          shape = new FabricLine([start.x, start.y, end.x, end.y], {
            stroke: currentColorRef.current,
            strokeWidth: currentWidthRef.current,
          });
          break;
      }
      
      if (shape) {
        shape.set('firebaseId', objectId);
        canvas.add(shape);
        canvas.renderAll();
        
        const shapeData = shape.toObject();
        const shapeRef = ref(db, `drawings/${sessionId}/paths/${objectId}`);
        set(shapeRef, shapeData).catch((error) => {
          console.error('Firebase save error:', error);
        });
      }
    };

    // テキスト追加関数
    const addText = (x: number, y: number) => {
      const FabricIText = fabricLib.IText || fabricLib.default?.IText;
      const timestamp = Date.now();
      const textId = `${userId}_${timestamp}`;
      
      const text = new FabricIText('テキストを入力', {
        left: x,
        top: y,
        fontFamily: 'Arial',
        fontSize: 20,
        fill: currentColorRef.current,
      });
      
      // FirebaseのIDをオブジェクトに設定
      text.set('firebaseId', textId);
      
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      canvas.renderAll();
      
      // テキスト編集完了時の保存
      text.on('editing:exited', () => {
        const textData = text.toObject();
        const textRef = ref(db, `drawings/${sessionId}/paths/${textId}`);
        set(textRef, textData).catch((error) => {
          console.error('Firebase save error:', error);
        });
      });
    };

    // パス作成完了時の処理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('path:created', (e: any) => {
      if (!e.path) return;
      
      if (currentToolRef.current === 'eraser') {
        const objects = canvas.getObjects();
        const eraserPath = e.path;
        
        // 消しゴム：交差するオブジェクトを削除
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        objects.forEach((obj: any) => {
          if (obj !== eraserPath && obj.intersectsWithObject && obj.intersectsWithObject(eraserPath)) {
            const firebaseId = obj.get('firebaseId');
            canvas.remove(obj);
            
            // Firebaseからも削除
            if (firebaseId) {
              const objectRef = ref(db, `drawings/${sessionId}/paths/${firebaseId}`);
              remove(objectRef).catch((error) => {
                console.error('Firebase delete error:', error);
              });
            }
          }
        });
        
        canvas.remove(eraserPath);
        return;
      }
      
      // パスをFirebaseに保存
      const timestamp = Date.now();
      const pathId = `${userId}_${timestamp}`;
      
      e.path.set('fill', '');
      e.path.set('firebaseId', pathId);
      
      const pathData = e.path.toObject();
      const pathRef = ref(db, `drawings/${sessionId}/paths/${pathId}`);
      set(pathRef, pathData).catch((error) => {
        console.error('Firebase save error:', error);
      });
    });

    return () => {
      canvas.dispose();
      unsubscribe();
    };
  }, [sessionId, userId, fabricLib]);

  // 色と線の太さの変更を処理
  useEffect(() => {
    if (fabricCanvasRef.current && fabricCanvasRef.current.freeDrawingBrush) {
      const canvas = fabricCanvasRef.current;
      if (currentTool === 'eraser') {
        canvas.freeDrawingBrush.color = '#FFFFFF';
        canvas.freeDrawingBrush.width = drawingWidth * 2;
      } else if (currentTool === 'pen') {
        canvas.freeDrawingBrush.color = drawingColor;
        canvas.freeDrawingBrush.width = drawingWidth;
      }
    }
  }, [drawingColor, drawingWidth, currentTool]);

  // ツール変更
  const setTool = (tool: DrawingTool) => {
    setCurrentTool(tool);
    
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      
      switch (tool) {
        case 'pen':
          canvas.isDrawingMode = true;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          canvas.freeDrawingBrush.color = drawingColor;
          canvas.freeDrawingBrush.width = drawingWidth;
          break;
        case 'eraser':
          canvas.isDrawingMode = true;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          canvas.freeDrawingBrush.color = '#FFFFFF';
          canvas.freeDrawingBrush.width = drawingWidth * 2;
          break;
        case 'select':
          canvas.isDrawingMode = false;
          canvas.selection = true;
          canvas.skipTargetFind = false;
          break;
        case 'rectangle':
        case 'circle':
        case 'line':
        case 'text':
          canvas.isDrawingMode = false;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          break;
        default:
          canvas.isDrawingMode = false;
          canvas.selection = false;
          canvas.skipTargetFind = true;
          break;
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

  // 全消去
  const clearCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      // Firebaseのデータも削除
      const pathsRef = ref(db, `drawings/${sessionId}/paths`);
      remove(pathsRef).catch((error) => {
        console.error('Firebase clear error:', error);
      });
    }
  };

  // Undo機能
  const undo = () => {
    if (fabricCanvasRef.current) {
      const objects = fabricCanvasRef.current.getObjects();
      if (objects.length > 0) {
        const lastObject = objects[objects.length - 1];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firebaseId = (lastObject as any).get('firebaseId');
        
        fabricCanvasRef.current.remove(lastObject);
        
        // Firebaseからも削除
        if (firebaseId) {
          const objectRef = ref(db, `drawings/${sessionId}/paths/${firebaseId}`);
          remove(objectRef).catch((error) => {
            console.error('Firebase delete error:', error);
          });
        }
      }
    }
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
    undo
  };
}
