'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useWhiteboard } from '@/hooks/useWhiteboard';
import { DrawingTool } from '@/whiteboard';

interface WhiteboardContextType {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCanvasReady: boolean;
  currentTool: DrawingTool;
  drawingColor: string;
  drawingWidth: number;
  zoomLevel: number;
  setTool: (tool: DrawingTool) => void;
  setDrawingColor: (color: string) => void;
  setDrawingWidth: (width: number) => void;
  clearCanvas: () => void;
  undo: () => boolean;
  redo: () => boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

interface WhiteboardProviderProps {
  children: ReactNode;
  sessionId: string;
  userId: string;
}

export function WhiteboardProvider({ children, sessionId, userId }: WhiteboardProviderProps) {
  const whiteboardState = useWhiteboard({ sessionId, userId });

  // WhiteboardContextTypeに必要なプロパティのみを抽出
  const contextValue: WhiteboardContextType = {
    canvasRef: whiteboardState.canvasRef,
    isCanvasReady: whiteboardState.isCanvasReady,
    currentTool: whiteboardState.currentTool,
    drawingColor: whiteboardState.drawingColor,
    drawingWidth: whiteboardState.drawingWidth,
    zoomLevel: whiteboardState.zoomLevel,
    setTool: whiteboardState.setTool,
    setDrawingColor: whiteboardState.setDrawingColor,
    setDrawingWidth: whiteboardState.setDrawingWidth,
    clearCanvas: whiteboardState.clearCanvas,
    undo: whiteboardState.undo,
    redo: whiteboardState.redo,
    zoomIn: whiteboardState.zoomIn,
    zoomOut: whiteboardState.zoomOut,
    resetZoom: whiteboardState.resetZoom,
  };

  return (
    <WhiteboardContext.Provider value={contextValue}>
      {children}
    </WhiteboardContext.Provider>
  );
}

export function useWhiteboardContext() {
  const context = useContext(WhiteboardContext);
  if (context === undefined) {
    throw new Error('useWhiteboardContext must be used within a WhiteboardProvider');
  }
  return context;
} 