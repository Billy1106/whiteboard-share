import { DrawingContext, DrawingTool } from '../types/command';

export class PreviewCommand {
  private context: DrawingContext;
  private previewObject: fabric.Object | null = null;
  private tool: DrawingTool;
  private color: string;
  private width: number;

  constructor(context: DrawingContext, tool: DrawingTool, color: string, width: number) {
    this.context = context;
    this.tool = tool;
    this.color = color;
    this.width = width;
  }

  /**
   * プレビュー図形を作成
   */
  createPreview(startPoint: { x: number; y: number }): fabric.Object | null {
    this.removePreview(); // 既存のプレビューを削除
    
    this.previewObject = this.createPreviewShape(startPoint);
    
    if (this.previewObject) {
      this.context.canvas.add(this.previewObject);
      this.context.canvas.renderAll();
    }

    return this.previewObject;
  }

  /**
   * プレビュー図形を更新
   */
  updatePreview(startPoint: { x: number; y: number }, endPoint: { x: number; y: number }): void {
    if (!this.previewObject) return;

    this.updatePreviewShape(this.previewObject, startPoint, endPoint);
    this.context.canvas.renderAll();
  }

  /**
   * プレビュー図形を削除
   */
  removePreview(): void {
    if (this.previewObject) {
      this.context.canvas.remove(this.previewObject);
      this.context.canvas.renderAll();
      this.previewObject = null;
    }
  }

  /**
   * プレビュー図形が存在するかチェック
   */
  hasPreview(): boolean {
    return this.previewObject !== null;
  }

  /**
   * プレビュー図形を作成（ツールに応じて）
   */
  private createPreviewShape(start: { x: number; y: number }): fabric.Object | null {
    const commonStyles = {
      strokeDashArray: [8, 4],
      opacity: 0.7,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    };

    switch (this.tool) {
      case 'rectangle':
        return this.createRectanglePreview(start, commonStyles);
      case 'circle':
        return this.createCirclePreview(start, commonStyles);
      case 'line':
        return this.createLinePreview(start, commonStyles);
      default:
        return null;
    }
  }

  /**
   * 四角形プレビューを作成
   */
  private createRectanglePreview(start: { x: number; y: number }, commonStyles: Record<string, unknown>): fabric.Object | null {
    const FabricRect = this.context.fabricLib.Rect;
    if (!FabricRect) return null;

    return new FabricRect({
      left: start.x - 10,
      top: start.y - 10,
      width: 20,
      height: 20,
      fill: 'transparent',
      stroke: this.color,
      strokeWidth: Math.max(2, this.width),
      ...commonStyles,
    }) as unknown as fabric.Object;
  }

  /**
   * 円プレビューを作成
   */
  private createCirclePreview(start: { x: number; y: number }, commonStyles: Record<string, unknown>): fabric.Object | null {
    const FabricCircle = this.context.fabricLib.Circle;
    if (!FabricCircle) return null;

    return new FabricCircle({
      left: start.x - 10,
      top: start.y - 10,
      radius: 10,
      fill: 'transparent',
      stroke: this.color,
      strokeWidth: Math.max(2, this.width),
      ...commonStyles,
    }) as unknown as fabric.Object;
  }

  /**
   * 線プレビューを作成
   */
  private createLinePreview(start: { x: number; y: number }, commonStyles: Record<string, unknown>): fabric.Object | null {
    const FabricLine = this.context.fabricLib.Line;
    if (!FabricLine) return null;

    return new FabricLine([start.x, start.y, start.x + 20, start.y], {
      stroke: this.color,
      strokeWidth: Math.max(2, this.width),
      ...commonStyles,
    }) as unknown as fabric.Object;
  }

  /**
   * プレビュー図形を更新（ツールに応じて）
   */
  private updatePreviewShape(shape: fabric.Object, start: { x: number; y: number }, end: { x: number; y: number }): void {
    switch (this.tool) {
      case 'rectangle':
        this.updateRectanglePreview(shape, start, end);
        break;
      case 'circle':
        this.updateCirclePreview(shape, start, end);
        break;
      case 'line':
        this.updateLinePreview(shape, start, end);
        break;
    }
  }

  /**
   * 四角形プレビューを更新
   */
  private updateRectanglePreview(shape: fabric.Object, start: { x: number; y: number }, end: { x: number; y: number }): void {
    shape.set({
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.max(3, Math.abs(end.x - start.x)),
      height: Math.max(3, Math.abs(end.y - start.y)),
    });
  }

  /**
   * 円プレビューを更新
   */
  private updateCirclePreview(shape: fabric.Object, start: { x: number; y: number }, end: { x: number; y: number }): void {
    const radius = Math.max(3, Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2);
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    
    (shape as unknown as { set: (props: { left: number; top: number; radius: number }) => void }).set({
      left: centerX - radius,
      top: centerY - radius,
      radius: radius,
    });
  }

  /**
   * 線プレビューを更新
   */
  private updateLinePreview(shape: fabric.Object, start: { x: number; y: number }, end: { x: number; y: number }): void {
    (shape as unknown as { set: (props: { x1: number; y1: number; x2: number; y2: number }) => void }).set({
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    });
  }
} 