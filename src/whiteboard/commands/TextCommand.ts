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
      // 初期作成時はFirebaseに保存せず、編集完了時に保存
      this.isExecuted = true;
    }
    
  }

  undo(): void {
    if (!this.isExecuted) {

      return;
    }



    // キャンバスからテキストオブジェクトを削除
    if (this.fabricObject) {
      this.removeFromCanvas(this.fabricObject);
    } else {
      this.removeFromCanvas();
    }
    
    // Firebaseから削除（undoの場合は常に削除を試行）
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
      text: this.textData.text || '',
      objectId: this.objectId
    };
  }

  private createText(): fabric.Object | null {
    if (!this.textData.startPoint) return null;

    const FabricIText = this.context.fabricLib.IText;
    
    const text = new FabricIText(this.textData.text || '', {
      left: this.textData.startPoint.x,
      top: this.textData.startPoint.y,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: this.textData.color,
      selectable: true,
      editable: true
    });

    return text as unknown as fabric.Object;
  }

  private setupTextEvents(): void {
    if (!this.fabricObject) return;

    // テキスト編集開始時の処理
    this.fabricObject.on('editing:entered', () => {
      if (this.fabricObject) {
        this.fabricObject.set('opacity', 1); // 編集開始時に不透明に
        this.context.canvas.renderAll();
      }
    });

    // テキスト編集完了時にFirebaseに保存
    this.fabricObject.on('editing:exited', () => {
      if (this.fabricObject) {
        const textObject = this.fabricObject as fabric.IText;
        const currentText = textObject.text?.trim() || '';
        
        // 空のテキストの場合はオブジェクトを削除
        if (currentText === '') {
          this.context.canvas.remove(this.fabricObject);
          this.context.canvas.renderAll();
          return;
        }
        
        // テキストに内容がある場合は不透明にしてFirebaseに保存
        this.fabricObject.set('opacity', 1);
        const textData = this.fabricObject.toObject();
        this.saveToFirebase(textData);
      }
    });

    // テキストを選択状態にしてすぐに編集モードに
    this.context.canvas.setActiveObject(this.fabricObject);
    (this.fabricObject as fabric.IText).enterEditing();
    this.context.canvas.renderAll();
  }
} 