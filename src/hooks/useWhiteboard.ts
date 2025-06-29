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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [startPoint, setStartPoint] = useState<any>(null);
  
  // 最新の値を参照するためのref
  const currentColorRef = useRef(drawingColor);
  const currentWidthRef = useRef(drawingWidth);
  
  // refの値を更新
  useEffect(() => {
    currentColorRef.current = drawingColor;
    currentWidthRef.current = drawingWidth;
  }, [drawingColor, drawingWidth]);

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
            // 通常の更新時：新しいオブジェクトのみを追加
            firebaseObjectIds.forEach((pathId) => {
              if (!loadedPathIds.has(pathId)) {
                restoreObject(data[pathId], pathId);
              }
            });
            canvas.renderAll();
          }
        } else if (isInitialLoad) {
          isInitialLoad = false;
        }
      } catch (error) {
        console.error('Data sync error:', error);
      }
    });

    // マウスイベントハンドラー
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', (opt: any) => {
      const pointer = canvas.getPointer(opt.e);
      setStartPoint(pointer);
      
      if (currentTool === 'text') {
        addText(pointer.x, pointer.y);
      }
    });

    canvas.on('mouse:up', () => {
      if (startPoint && ['rectangle', 'circle', 'line'].includes(currentTool)) {
        const pointer = canvas.getPointer(canvas.getActiveObject());
        if (pointer) {
          addShape(startPoint, pointer);
        }
      }
      setStartPoint(null);
    });

    // 図形追加関数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addShape = (start: any, end: any) => {
      let shape;
      const timestamp = Date.now();
      const objectId = `${userId}_${timestamp}`;
      
      switch (currentTool) {
        case 'rectangle':
          const FabricRect = fabricLib.Rect || fabricLib.default?.Rect;
          shape = new FabricRect({
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
            fill: 'transparent',
            stroke: currentColorRef.current,
            strokeWidth: currentWidthRef.current,
          });
          break;
        case 'circle':
          const FabricCircle = fabricLib.Circle || fabricLib.default?.Circle;
          const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
          shape = new FabricCircle({
            left: start.x,
            top: start.y,
            radius: radius,
            fill: 'transparent',
            stroke: currentColorRef.current,
            strokeWidth: currentWidthRef.current,
          });
          break;
        case 'line':
          const FabricLine = fabricLib.Line || fabricLib.default?.Line;
          shape = new FabricLine([start.x, start.y, end.x, end.y], {
            stroke: currentColorRef.current,
            strokeWidth: currentWidthRef.current,
          });
          break;
      }
      
      if (shape) {
        canvas.add(shape);
        canvas.renderAll();
        
        // 図形をFirebaseに保存
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
      const text = new FabricIText('テキストを入力', {
        left: x,
        top: y,
        fontFamily: 'Arial',
        fontSize: 20,
        fill: currentColorRef.current,
      });
      
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      canvas.renderAll();
      
      // テキスト編集完了時の保存
      text.on('editing:exited', () => {
        const timestamp = Date.now();
        const textId = `${userId}_${timestamp}`;
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
      
      if (currentTool === 'eraser') {
        const objects = canvas.getObjects();
        const eraserPath = e.path;
        
        // 消しゴム：交差するオブジェクトを削除
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        objects.forEach((obj: any) => {
          if (obj !== eraserPath && obj.intersectsWithObject && obj.intersectsWithObject(eraserPath)) {
            canvas.remove(obj);
          }
        });
        
        canvas.remove(eraserPath);
        return;
      }
      
      // パスをFirebaseに保存
      e.path.set('fill', '');
      const pathData = e.path.toObject();
      const timestamp = Date.now();
      const pathId = `${userId}_${timestamp}`;
      
      const pathRef = ref(db, `drawings/${sessionId}/paths/${pathId}`);
      set(pathRef, pathData).catch((error) => {
        console.error('Firebase save error:', error);
      });
    });

    return () => {
      canvas.dispose();
      unsubscribe();
    };
  }, [sessionId, userId, fabricLib, currentTool]);

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
          canvas.freeDrawingBrush.color = drawingColor;
          canvas.freeDrawingBrush.width = drawingWidth;
          break;
        case 'eraser':
          canvas.isDrawingMode = true;
          canvas.selection = false;
          canvas.freeDrawingBrush.color = '#FFFFFF';
          canvas.freeDrawingBrush.width = drawingWidth * 2;
          break;
        case 'select':
          canvas.isDrawingMode = false;
          canvas.selection = true;
          break;
        default:
          canvas.isDrawingMode = false;
          canvas.selection = false;
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
        fabricCanvasRef.current.remove(lastObject);
        // 実際の実装では、より詳細なundo/redo履歴管理が必要
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
