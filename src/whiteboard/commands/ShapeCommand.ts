import { BaseCommand } from './BaseCommand';
import { DrawingContext, DrawingData } from '../types/command';

export class ShapeCommand extends BaseCommand {
  private shapeData: DrawingData;
  private fabricObject: fabric.Object | null = null;

  constructor(context: DrawingContext, shapeData: DrawingData) {
    super(context, shapeData.objectId);
    this.shapeData = shapeData;
  }

  execute(): void {
    if (this.isExecuted) return;

    this.fabricObject = this.createShape();
    if (this.fabricObject) {
      this.addToCanvas(this.fabricObject);
      this.saveToFirebase(this.fabricObject.toObject());
      this.isExecuted = true;
    }
  }

  undo(): void {
    if (!this.isExecuted) return;

    if (this.fabricObject) {
      this.removeFromCanvas(this.fabricObject);
    } else {
      this.removeFromCanvas();
    }
    this.removeFromFirebase();
    this.isExecuted = false;
  }

  getType(): string {
    return `shape_${this.shapeData.tool}`;
  }

  getData(): Record<string, unknown> {
    return {
      tool: this.shapeData.tool,
      color: this.shapeData.color,
      width: this.shapeData.width,
      startPoint: this.shapeData.startPoint,
      endPoint: this.shapeData.endPoint,
      objectId: this.objectId
    };
  }

  private createShape(): fabric.Object | null {
    const { tool, color, width, startPoint, endPoint } = this.shapeData;
    
    if (!startPoint || !endPoint) return null;

    switch (tool) {
      case 'rectangle':
        return this.createRectangle(startPoint, endPoint, color, width);
      case 'circle':
        return this.createCircle(startPoint, endPoint, color, width);
      case 'line':
        return this.createLine(startPoint, endPoint, color, width);
      default:
        return null;
    }
  }

  private createRectangle(start: { x: number; y: number }, end: { x: number; y: number }, color: string, width: number): fabric.Object {
    const FabricRect = this.context.fabricLib.Rect;
    const rectWidth = Math.max(5, Math.abs(end.x - start.x));
    const rectHeight = Math.max(5, Math.abs(end.y - start.y));

    return new FabricRect({
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: rectWidth,
      height: rectHeight,
      fill: 'transparent',
      stroke: color,
      strokeWidth: width,
    }) as unknown as fabric.Object;
  }

  private createCircle(start: { x: number; y: number }, end: { x: number; y: number }, color: string, width: number): fabric.Object {
    const FabricCircle = this.context.fabricLib.Circle;
    const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;

    return new FabricCircle({
      left: centerX - radius,
      top: centerY - radius,
      radius: radius,
      fill: 'transparent',
      stroke: color,
      strokeWidth: width,
    }) as unknown as fabric.Object;
  }

  private createLine(start: { x: number; y: number }, end: { x: number; y: number }, color: string, width: number): fabric.Object {
    const FabricLine = this.context.fabricLib.Line;

    return new FabricLine([start.x, start.y, end.x, end.y], {
      stroke: color,
      strokeWidth: width,
    }) as unknown as fabric.Object;
  }
} 