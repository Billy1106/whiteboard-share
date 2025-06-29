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
      // undefinedの値を除去
      const cleanData = this.removeUndefinedValues(data) as Record<string, unknown>;
      const pathRef = ref(db, `drawings/${this.context.sessionId}/paths/${this.objectId}`);
      set(pathRef, cleanData)
        .then(() => {
    
        })
        .catch((error) => {
          console.error('Firebase save error:', error);
        });
    } catch (error) {
      console.error('Firebase save setup error:', error);
    }
  }

  /**
   * undefinedの値を再帰的に除去
   */
  private removeUndefinedValues(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  protected removeFromFirebase(): void {
    try {
      const pathRef = ref(db, `drawings/${this.context.sessionId}/paths/${this.objectId}`);
  
      
      remove(pathRef)
                  .then(() => {
            
          })
        .catch((error) => {
          console.error('Firebase削除エラー:', this.objectId, error);
        });
    } catch (error) {
      console.error('Firebase削除設定エラー:', this.objectId, error);
    }
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

      
      const targetObject = objects.find((obj: fabric.Object) => {
        const firebaseId = (obj as fabric.Object & { firebaseId?: string }).firebaseId;
        
        return firebaseId === this.objectId;
      });
      
              if (targetObject) {
          
          this.context.canvas.remove(targetObject);
        } else {
          
        }
          }
      
      this.context.canvas.renderAll();
      
  }
} 