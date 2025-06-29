import { ref, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { BaseCommand } from './BaseCommand';
import { DrawingContext } from '../types/command';

export class ClearCommand extends BaseCommand {
  private clearedObjects: Array<{ object: fabric.Object; data: Record<string, unknown>; firebaseId: string }> = [];

  constructor(context: DrawingContext) {
    super(context);
  }

  execute(): void {
    if (this.isExecuted) return;

    const objects = this.context.canvas.getObjects();
    
    // 全オブジェクトの情報を保存
    objects.forEach((obj: fabric.Object) => {
      const firebaseId = (obj as fabric.Object & { firebaseId?: string }).firebaseId;
      
      if (firebaseId) {
        this.clearedObjects.push({
          object: obj,
          data: obj.toObject(),
          firebaseId: firebaseId
        });
      }
    });

    // キャンバスをクリア
    this.context.canvas.clear();
    
    // Firebaseからも全削除
    const pathsRef = ref(db, `drawings/${this.context.sessionId}/paths`);
    remove(pathsRef).catch((error) => {
      console.error('Firebase clear error:', error);
    });

    this.context.canvas.renderAll();
    this.isExecuted = true;
  }

  undo(): void {
    if (!this.isExecuted) return;

    // 全オブジェクトを復元
    this.clearedObjects.forEach(({ object, data, firebaseId }) => {
      (object as fabric.Object & { firebaseId?: string }).firebaseId = firebaseId;
      this.context.canvas.add(object);
      
      // Firebaseにも復元
      this.saveToFirebase(data);
    });

    this.context.canvas.renderAll();
    this.isExecuted = false;
  }

  getType(): string {
    return 'clear';
  }

  getData(): Record<string, unknown> {
    return {
      clearedObjectsCount: this.clearedObjects.length,
      clearedObjectIds: this.clearedObjects.map(item => item.firebaseId),
      objectId: this.objectId
    };
  }
} 