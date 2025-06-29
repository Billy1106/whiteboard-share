export interface Command {
  execute(): void;
  undo(): void;
  getType(): string;
  getData(): Record<string, unknown>;
}

export interface DrawingContext {
  canvas: fabric.Canvas;
  sessionId: string;
  userId: string;
  fabricLib: typeof import('fabric');
}

export type DrawingTool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'select' | 'hand';

export interface DrawingData {
  tool: DrawingTool;
  color: string;
  width: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
  objectId?: string;
}

export interface PathData {
  type: string;
  path?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  radius?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  [key: string]: unknown;
} 