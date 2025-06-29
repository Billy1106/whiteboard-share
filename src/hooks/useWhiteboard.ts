import { useEffect, useRef, useState } from 'react';
import { ref, set, onChildAdded } from 'firebase/database';
import { db } from '@/lib/firebase';

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
      isDrawingMode: true,
      selection: false,
      width: canvasWidth,
      height: canvasHeight,
    });
    fabricCanvasRef.current = canvas;

    let isDrawing = false;

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
        
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        
        const canvasElement = canvas.getElement();
        if (canvasElement) {
          canvasElement.style.cursor = 'crosshair';
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
    let isInitialLoad = true;
    
    const unsubscribe = onChildAdded(pathsRef, (snapshot) => {
      const pathData = snapshot.val();
      const pathId = snapshot.key;
      
      if (!pathId || !pathData || loadedPathIds.has(pathId)) return;
      
      // 描画中は新規パスの同期をスキップ（初回読み込みは継続）
      if (!isInitialLoad && isDrawing) return;
      
      const FabricPath = fabricLib.Path || fabricLib.default?.Path;
      if (!FabricPath) return;

      try {
        // fabric.Path.fromObjectを使用（v6.x対応）
        if (FabricPath.fromObject) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pathObjectOrPromise = FabricPath.fromObject(pathData);
          
          if (pathObjectOrPromise instanceof Promise) {
            // 非同期処理
            pathObjectOrPromise.then((pathObject) => {
              if (pathObject) {
                configurePathObject(pathObject, pathData);
                addPathToCanvas(pathObject, pathId, loadedPathIds);
                
                if (isInitialLoad) {
                  setTimeout(() => { isInitialLoad = false; }, 1000);
                }
              }
            }).catch(() => {
              // フォールバック: コンストラクタ使用
              const pathObject = new FabricPath(pathData.path, pathData);
              configurePathObject(pathObject, pathData);
              addPathToCanvas(pathObject, pathId, loadedPathIds);
            });
          } else if (pathObjectOrPromise) {
            // 同期処理
            configurePathObject(pathObjectOrPromise, pathData);
            addPathToCanvas(pathObjectOrPromise, pathId, loadedPathIds);
            
            if (isInitialLoad) {
              setTimeout(() => { isInitialLoad = false; }, 1000);
            }
          }
        } else {
          // フォールバック: コンストラクタ使用
          const pathObject = new FabricPath(pathData.path, pathData);
          configurePathObject(pathObject, pathData);
          addPathToCanvas(pathObject, pathId, loadedPathIds);
          
          if (isInitialLoad) {
            setTimeout(() => { isInitialLoad = false; }, 1000);
          }
        }
      } catch (error) {
        console.error('Path creation error:', error);
      }
    });

    // 描画イベントリスナー
    canvas.on('mouse:down', () => { isDrawing = true; });
    canvas.on('mouse:up', () => {
      setTimeout(() => { isDrawing = false; }, 50);
    });

    // パス作成完了時にFirebaseに保存
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('path:created', (e: any) => {
      if (!e.path) return;
      
      // fillを空に設定してからFirebaseに保存
      e.path.set('fill', '');
      
      const pathData = e.path.toObject();
      const timestamp = Date.now();
      const pathId = `${userId}_${timestamp}`;
      
      const pathRef = ref(db, `drawings/${sessionId}/paths/${pathId}`);
      set(pathRef, pathData)
        .catch((error) => {
          console.error('Firebase save error:', error);
        });
    });

    return () => {
      canvas.dispose();
      unsubscribe();
    };
  }, [sessionId, userId, fabricLib]);

  // 描画色を設定
  const setDrawingColor = (color: string) => {
    if (fabricCanvasRef.current && fabricCanvasRef.current.freeDrawingBrush) {
      fabricCanvasRef.current.freeDrawingBrush.color = color;
    }
  };

  // 描画幅を設定
  const setDrawingWidth = (width: number) => {
    if (fabricCanvasRef.current && fabricCanvasRef.current.freeDrawingBrush) {
      fabricCanvasRef.current.freeDrawingBrush.width = width;
    }
  };

  return { 
    canvasRef, 
    fabricCanvasRef, 
    isCanvasReady, 
    setDrawingColor, 
    setDrawingWidth 
  };
}
