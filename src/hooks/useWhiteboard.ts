import { useEffect, useRef, useState } from 'react';
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





    let unsubscribe: (() => void) | null = null;
    
    // 初期化を実行
    setTimeout(() => {
      try {
        // キャンバス初期化
        manager.initializeCanvas();
        
        // イベントハンドラーを設定（ズーム、マウス、キーボード）
        manager.setupEventHandlers((zoom) => setZoomLevel(zoom));
        
        // Firebase同期を開始
        unsubscribe = manager.startFirebaseSync();
        
        setIsCanvasReady(true);
      } catch (error) {
        console.error('Canvas initialization error:', error);
      }
    }, 100);

    return () => {
      canvas.dispose();
      if (unsubscribe) {
        unsubscribe();
      }
      whiteboardManagerRef.current?.cleanupEventHandlers();
    };
  }, [sessionId, userId, fabricLib]);

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
    if (whiteboardManagerRef.current) {
      whiteboardManagerRef.current.zoomIn();
      const newZoom = whiteboardManagerRef.current.getZoomLevel();
      setZoomLevel(newZoom);
    }
  };

  // ズームアウト機能
  const zoomOut = () => {
    if (whiteboardManagerRef.current) {
      whiteboardManagerRef.current.zoomOut();
      const newZoom = whiteboardManagerRef.current.getZoomLevel();
      setZoomLevel(newZoom);
    }
  };

  // ズームリセット機能
  const resetZoom = () => {
    if (whiteboardManagerRef.current) {
      whiteboardManagerRef.current.resetZoom();
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
