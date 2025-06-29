import { ref, set, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Command, DrawingContext } from '../types/command';

export abstract class BaseCommand implements Command {
  protected context: DrawingContext;
  protected objectId: string;
  protected isExecuted: boolean = false;

  constructor(context: DrawingContext, objectId?: string) {
    this.context = context;
    this.objectId = objectId || `${context.userId}_${Date.now()}`;
  }

  abstract execute(): void;
  abstract undo(): void;
  abstract getType(): string;
  abstract getData(): Record<string, unknown>;

  /**
   * Firebaseにデータを保存
   */
  protected saveToFirebase(data: Record<string, unknown>): void {
    try {
      console.log('Saving to Firebase:', this.objectId, data);
      const pathRef = ref(db, `drawings/${this.context.sessionId}/paths/${this.objectId}`);
      set(pathRef, data)
        .then(() => {
          console.log('Saved to Firebase successfully');
        })
        .catch((error) => {
          console.error('Firebase save error:', error);
        });
    } catch (error) {
      console.error('Firebase save setup error:', error);
    }
  }

  protected removeFromFirebase(): void {
    const pathRef = ref(db, `drawings/${this.context.sessionId}/paths/${this.objectId}`);
    remove(pathRef).catch((error) => {
      console.error('Firebase delete error:', error);
    });
  }

  protected addToCanvas(fabricObject: fabric.Object): void {
    (fabricObject as fabric.Object & { firebaseId?: string }).firebaseId = this.objectId;
    this.context.canvas.add(fabricObject);
    this.context.canvas.renderAll();
  }

  protected removeFromCanvas(fabricObject: fabric.Object | null = null): void {
    if (fabricObject) {
      this.context.canvas.remove(fabricObject);
    } else {
      // firebaseIdで検索して削除
      const objects = this.context.canvas.getObjects();
      const targetObject = objects.find((obj: fabric.Object) => 
        (obj as fabric.Object & { firebaseId?: string }).firebaseId === this.objectId
      );
      
      if (targetObject) {
        this.context.canvas.remove(targetObject);
      }
    }
    this.context.canvas.renderAll();
  }
} 