import { BaseCommand } from './BaseCommand';
import { DrawingContext } from '../types/command';

export class PathCommand extends BaseCommand {
  private pathData: Record<string, unknown>;
  private fabricObject: fabric.Object | null = null;

  constructor(context: DrawingContext, pathData: Record<string, unknown>, objectId?: string) {
    super(context, objectId);
    this.pathData = pathData;
  }

  execute(): void {
    if (this.isExecuted) return;

    this.fabricObject = this.createPath();
    if (this.fabricObject) {
      this.addToCanvas(this.fabricObject);
      this.saveToFirebase(this.pathData);
      this.isExecuted = true;
    } else {
      this.handleAsyncPathCreation();
    }
  }

  private async handleAsyncPathCreation(): Promise<void> {
    try {
      const pathObject = await this.createPathAsync();
      if (pathObject) {
        this.fabricObject = pathObject;
        this.addToCanvas(this.fabricObject);
        this.saveToFirebase(this.pathData);
        this.isExecuted = true;
      }
    } catch (error) {
      console.error('Async path creation error:', error);
    }
  }

  private async createPathAsync(): Promise<fabric.Object | null> {
    try {
      const FabricPath = this.context.fabricLib.Path;
      
      if (FabricPath.fromObject) {
        const pathObjectOrPromise = FabricPath.fromObject(this.pathData);
        
        if (pathObjectOrPromise instanceof Promise) {
          const pathObject = await pathObjectOrPromise;
          if (pathObject) {
            this.configurePathObject(pathObject as unknown as fabric.Path);
            return pathObject as unknown as fabric.Object;
          }
        } else {
          this.configurePathObject(pathObjectOrPromise as unknown as fabric.Path);
          return pathObjectOrPromise as unknown as fabric.Object;
        }
      }
      
      return this.createPathDirectly();
    } catch (error) {
      console.error('Async path creation error:', error);
      return this.createPathDirectly();
    }
  }

  private createPath(): fabric.Object | null {
    try {
      const FabricPath = this.context.fabricLib.Path;
      
      if (FabricPath.fromObject) {
        const pathObjectOrPromise = FabricPath.fromObject(this.pathData);
        
        if (pathObjectOrPromise instanceof Promise) {
          return null;
        } else {
          this.configurePathObject(pathObjectOrPromise as unknown as fabric.Path);
          return pathObjectOrPromise as unknown as fabric.Object;
        }
      } else {
        return this.createPathDirectly();
      }
    } catch (error) {
      console.error('Path creation error:', error);
      return this.createPathDirectly();
    }
  }

  undo(): void {
    if (!this.isExecuted) {

      return;
    }



    if (this.fabricObject) {
      this.removeFromCanvas(this.fabricObject);
    } else {
      this.removeFromCanvas();
    }
    this.removeFromFirebase();
    this.isExecuted = false;
    

  }

  getType(): string {
    return 'path';
  }

  getData(): Record<string, unknown> {
    return {
      ...this.pathData,
      objectId: this.objectId
    };
  }

  private createPathDirectly(): fabric.Object | null {
    const FabricPath = this.context.fabricLib.Path;
    const pathObject = new FabricPath(this.pathData.path as string, this.pathData);
    this.configurePathObject(pathObject as unknown as fabric.Path);
    return pathObject as unknown as fabric.Object;
  }

  private configurePathObject(pathObject: fabric.Path): void {
    pathObject.set({
      fill: '',
      stroke: (this.pathData.stroke as string) || '#000000',
      strokeWidth: (this.pathData.strokeWidth as number) || 5
    });
  }
} 