import { BaseCommand } from './BaseCommand';
import { DrawingContext, DrawingData } from '../types/command';

export class TextCommand extends BaseCommand {
  private textData: DrawingData;
  private fabricObject: fabric.Object | null = null;

  constructor(context: DrawingContext, textData: DrawingData) {
    super(context, textData.objectId);
    this.textData = textData;
  }

  execute(): void {
    if (this.isExecuted) return;

    this.fabricObject = this.createText();
    if (this.fabricObject) {
      this.addToCanvas(this.fabricObject);
      this.setupTextEvents();
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
    return 'text';
  }

  getData(): Record<string, unknown> {
    return {
      tool: this.textData.tool,
      color: this.textData.color,
      startPoint: this.textData.startPoint,
      text: this.textData.text || 'テキストを入力',
      objectId: this.objectId
    };
  }

  private createText(): fabric.Object | null {
    if (!this.textData.startPoint) return null;

    const FabricIText = this.context.fabricLib.IText;
    
    const text = new FabricIText(this.textData.text || 'テキストを入力', {
      left: this.textData.startPoint.x,
      top: this.textData.startPoint.y,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: this.textData.color,
    });

    return text as unknown as fabric.Object;
  }

  private setupTextEvents(): void {
    if (!this.fabricObject) return;

    // テキスト編集完了時にFirebaseに保存
    this.fabricObject.on('editing:exited', () => {
      if (this.fabricObject) {
        this.saveToFirebase(this.fabricObject.toObject());
      }
    });

    // テキストを選択状態にしてすぐに編集モードに
    this.context.canvas.setActiveObject(this.fabricObject);
    (this.fabricObject as fabric.IText).enterEditing();
    (this.fabricObject as fabric.IText).selectAll();
    this.context.canvas.renderAll();
  }
} 