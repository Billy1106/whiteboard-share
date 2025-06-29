import { ref, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { BaseCommand } from './BaseCommand';
import { DrawingContext } from '../types/command';

export class EraserCommand extends BaseCommand {
  private erasedObjects: Array<{ object: fabric.Object; data: Record<string, unknown>; firebaseId: string }> = [];
  private eraserPath: fabric.Object;

  constructor(context: DrawingContext, eraserPath: fabric.Object) {
    super(context);
    this.eraserPath = eraserPath;
  }

  execute(): void {
    if (this.isExecuted) return;

    const objects = this.context.canvas.getObjects();
    
    // 消しゴムパスと交差するオブジェクトを検索
    objects.forEach((obj: fabric.Object) => {
      if (obj !== this.eraserPath && obj.intersectsWithObject && obj.intersectsWithObject(this.eraserPath)) {
        const firebaseId = (obj as fabric.Object & { firebaseId?: string }).firebaseId;
        
        if (firebaseId) {
          // 削除前にオブジェクトの情報を保存
          this.erasedObjects.push({
            object: obj,
            data: obj.toObject(),
            firebaseId: firebaseId
          });
          
          // キャンバスから削除
          this.context.canvas.remove(obj);
          
          // Firebaseからも削除
          this.removeErasedObjectsFromFirebase();
        }
      }
    });

    // 消しゴムパス自体も削除
    this.context.canvas.remove(this.eraserPath);

    this.context.canvas.renderAll();
    this.isExecuted = true;
  }

  undo(): void {
    if (!this.isExecuted) return;

    // 消去されたオブジェクトを復元
    this.erasedObjects.forEach(({ object, data, firebaseId }) => {
      (object as fabric.Object & { firebaseId?: string }).firebaseId = firebaseId;
      this.context.canvas.add(object);
      
      // Firebaseにも復元
      this.saveToFirebase(data);
    });

    this.context.canvas.renderAll();
    this.isExecuted = false;
  }

  getType(): string {
    return 'eraser';
  }

  getData(): Record<string, unknown> {
    return {
      erasedObjectsCount: this.erasedObjects.length,
      erasedObjectIds: this.erasedObjects.map(item => item.firebaseId),
      objectId: this.objectId
    };
  }

  private removeErasedObjectsFromFirebase(): void {
    this.erasedObjects.forEach(({ firebaseId }) => {
      const pathRef = ref(db, `drawings/${this.context.sessionId}/paths/${firebaseId}`);
      remove(pathRef).catch((error: unknown) => {
        console.error('Firebase delete error:', error);
      });
    });
  }
} 