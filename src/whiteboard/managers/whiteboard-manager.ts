import { CommandManager } from './command-manager';
import { 
  ShapeCommand, 
  TextCommand, 
  PathCommand, 
  EraserCommand, 
  ClearCommand,
  PreviewCommand
} from '../commands';
import { DrawingContext, DrawingData, DrawingTool } from '../types/command';
import { ref, onValue, Unsubscribe } from 'firebase/database';
import { db } from '@/lib/firebase';

export class WhiteboardManager {
  private commandManager: CommandManager;
  private context: DrawingContext;
  private previewCommand: PreviewCommand | null = null;
  private currentTool: DrawingTool = 'pen';
  private currentColor: string = '#000000';
  private currentWidth: number = 5;
  private screenMousePosition: { x: number; y: number } | null = null;
  private isSpacePressed: boolean = false;
  private eventHandlers: { [key: string]: (e: KeyboardEvent) => void } = {};
  
  // パンニング状態
  private isPanning: boolean = false;
  private lastPanX: number = 0;
  private lastPanY: number = 0;
  
  // Firebase同期
  private firebaseUnsubscribe: Unsubscribe | null = null;
  private loadedPathIds: Set<string> = new Set();
  private isInitialLoad: boolean = true;

  constructor(context: DrawingContext) {
    this.context = context;
    this.commandManager = new CommandManager();
  }

  /**
   * 現在のツールを設定
   */
  setTool(tool: DrawingTool): void {
    this.currentTool = tool;
    this.updateCanvasMode();
    this.updatePreviewCommand();

  }

  /**
   * 現在のツールを取得
   */
  getCurrentTool(): DrawingTool {
    return this.currentTool;
  }

  /**
   * ズームイン
   */
  zoomIn(screenMousePosition?: { x: number; y: number }): void {
    const canvas = this.context.canvas;
    let zoom = canvas.getZoom();
    zoom = zoom * 1.1;
    if (zoom > 5) zoom = 5;

    const zoomPoint = screenMousePosition || this.screenMousePosition || {
      x: canvas.getWidth() / 2,
      y: canvas.getHeight() / 2
    };
    canvas.zoomToPoint(zoomPoint, zoom);
  }

  /**
   * ズームアウト
   */
  zoomOut(screenMousePosition?: { x: number; y: number }): void {
    const canvas = this.context.canvas;
    let zoom = canvas.getZoom();
    zoom = zoom * 0.9;
    if (zoom < 0.1) zoom = 0.1;

    const zoomPoint = screenMousePosition || this.screenMousePosition || {
      x: canvas.getWidth() / 2,
      y: canvas.getHeight() / 2
    };
    canvas.zoomToPoint(zoomPoint, zoom);
  }

  /**
   * ズームリセット
   */
  resetZoom(): void {
    const canvas = this.context.canvas;
    canvas.setZoom(1);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  }

  /**
   * 現在のズームレベルを取得
   */
  getZoomLevel(): number {
    return this.context.canvas.getZoom();
  }

  /**
   * キャンバスのイベントハンドラーをセットアップ
   */
  setupEventHandlers(onZoomChange?: (zoom: number) => void): void {
    this.setupZoomControls(onZoomChange);
    this.setupMouseEvents();
    this.setupKeyboardEvents();
  }

  /**
   * イベントハンドラーをクリーンアップ
   */
  cleanupEventHandlers(): void {
    // キーボードイベントを削除
    Object.values(this.eventHandlers).forEach(handler => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('keyup', handler);
    });
    this.eventHandlers = {};
  }

  /**
   * ズーム機能を設定
   */
  private setupZoomControls(onZoomChange?: (zoom: number) => void): void {
    const canvas = this.context.canvas;

    // マウスホイールでのズーム
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:wheel', (opt: any) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      
      // ズームレベルを0.1倍から5倍の間に制限
      if (zoom > 5) zoom = 5;
      if (zoom < 0.1) zoom = 0.1;
      
      // DOM座標系でのマウス位置を取得（ズーム不変）
      const rect = canvas.getElement().getBoundingClientRect();
      const pointer = {
        x: opt.e.clientX - rect.left,
        y: opt.e.clientY - rect.top
      };
      
      canvas.zoomToPoint(pointer, zoom);
      
      // ズームレベル変更を通知
      if (onZoomChange) {
        onZoomChange(zoom);
      }
      
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // タッチ（ピンチ）ズーム
    let isZooming = false;
    let lastDistance = 0;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('touch:gesture', (opt: any) => {
      if (opt.e.touches && opt.e.touches.length === 2) {
        const touch1 = opt.e.touches[0];
        const touch2 = opt.e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (isZooming) {
          const scale = distance / lastDistance;
          let zoom = canvas.getZoom() * scale;
          
          if (zoom > 5) zoom = 5;
          if (zoom < 0.1) zoom = 0.1;
          
          const centerX = (touch1.clientX + touch2.clientX) / 2;
          const centerY = (touch1.clientY + touch2.clientY) / 2;
          const rect = canvas.getElement().getBoundingClientRect();
          const pointer = {
            x: centerX - rect.left,
            y: centerY - rect.top
          };
          
          canvas.zoomToPoint(pointer, zoom);
          
          if (onZoomChange) {
            onZoomChange(zoom);
          }
        }
        
        lastDistance = distance;
        isZooming = true;
        opt.e.preventDefault();
      } else {
        isZooming = false;
      }
    });

    // マウス位置を追跡（DOM座標系でズーム用）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:move', (opt: any) => {
      // DOM座標系（ズーム用）
      const rect = canvas.getElement().getBoundingClientRect();
      const screenPointer = {
        x: opt.e.clientX - rect.left,
        y: opt.e.clientY - rect.top
      };
             this.screenMousePosition = screenPointer;
     });
   }

  /**
   * マウスイベントを設定
   */
  private setupMouseEvents(): void {
    const canvas = this.context.canvas;
    let isDown = false;
    let startPoint: { x: number; y: number } | null = null;
    
    // マウスダウンイベント
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:down', (opt: any) => {
      const tool = this.getCurrentTool();
      
      // handツールの場合はパンニング処理
      if (tool === 'hand') {
        this.startPanning(opt.e);
        opt.e.preventDefault();
        return;
      }
      
      // ペンと消しゴムはfreeDrawingModeで処理されるのでスキップ
      if (['pen', 'eraser'].includes(tool)) {
        return;
      }
      
      if (!['rectangle', 'circle', 'line', 'text'].includes(tool)) {
        return;
      }
      
      isDown = true;
      const pointer = canvas.getPointer(opt.e);
      startPoint = pointer;
      
      if (tool === 'text') {
        this.addText(pointer);
        return;
      }
      
      // 図形描画開始時にプレビューを開始
      if (['rectangle', 'circle', 'line'].includes(tool)) {
        this.startPreview(pointer);
      }
    });

    // マウス移動イベント
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:move', (opt: any) => {
      // パンニング処理
      this.updatePanning(opt.e);
      
      // プレビュー更新
      if (!isDown || !startPoint) {
        return;
      }
      
      const pointer = canvas.getPointer(opt.e);
      
      if (this.hasPreview()) {
        this.updatePreview(startPoint, pointer);
      }
    });

    // マウスアップイベント
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('mouse:up', (opt: any) => {
      // パンニング終了
      this.stopPanning();
      
      // 図形描画終了
      if (!isDown || !startPoint) {
        return;
      }
      
      isDown = false;
      const pointer = canvas.getPointer(opt.e);
      const tool = this.getCurrentTool();
      
      if (this.hasPreview() && ['rectangle', 'circle', 'line'].includes(tool)) {
        this.endPreview();
        
        const distance = Math.max(Math.abs(pointer.x - startPoint.x), Math.abs(pointer.y - startPoint.y));
        
        if (distance > 3) {
          this.drawShape(startPoint, pointer);
        }
      }
      
      startPoint = null;
    });

    // パス作成完了時の処理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('path:created', (e: any) => {
      if (!e.path) return;
      
      const tool = this.getCurrentTool();
      
      if (tool === 'eraser') {
        this.eraseObjects(e.path);
        return;
      }
      
      if (tool === 'pen') {
        // Fabricjsが自動的にキャンバスに追加したパスを一旦削除
        canvas.remove(e.path);
        
        // パスデータを準備
        e.path.set('fill', '');
        const pathData = e.path.toObject();
        
        // パスオブジェクトに一意のIDを生成・設定
        const objectId = `${this.context.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // コマンドパターンでペン描画を実行
        this.addPath(pathData, objectId);
      }
    });
  }

  /**
   * キーボードイベントを設定
   */
  private setupKeyboardEvents(): void {
    const canvas = this.context.canvas;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        if (canvas) {
          canvas.defaultCursor = 'grab';
        }
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (canvas) {
          canvas.defaultCursor = this.currentTool === 'hand' ? 'grab' : 'default';
        }
        e.preventDefault();
      }
    };

    // イベントハンドラーを記録してクリーンアップ時に削除できるようにする
    this.eventHandlers['keydown'] = handleKeyDown;
    this.eventHandlers['keyup'] = handleKeyUp;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  }

  /**
   * パンニング開始
   */
  private startPanning(evt: MouseEvent): void {
    this.isPanning = true;
    this.context.canvas.selection = false;
    this.lastPanX = evt.clientX;
    this.lastPanY = evt.clientY;
    this.context.canvas.defaultCursor = 'grabbing';
    this.context.canvas.renderAll();
  }

  /**
   * パンニング更新
   */
  private updatePanning(evt: MouseEvent): void {
    if (this.isPanning) {
      const vpt = this.context.canvas.viewportTransform;
      if (vpt) {
        vpt[4] += evt.clientX - this.lastPanX;
        vpt[5] += evt.clientY - this.lastPanY;
        this.context.canvas.requestRenderAll();
        this.lastPanX = evt.clientX;
        this.lastPanY = evt.clientY;
      }
    }
  }

  /**
   * パンニング終了
   */
  private stopPanning(): void {
    this.isPanning = false;
    this.context.canvas.selection = true;
    this.context.canvas.defaultCursor = 'default';
    this.context.canvas.renderAll();
  }

  /**
   * キャンバスを初期化
   */
  initializeCanvas(): void {
    const canvas = this.context.canvas;
    const fabricLib = this.context.fabricLib;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FabricPencilBrush = (fabricLib as any).PencilBrush;
      if (FabricPencilBrush) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (canvas as any).freeDrawingBrush = new FabricPencilBrush(canvas);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (canvas as any).freeDrawingBrush.width = this.currentWidth;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (canvas as any).freeDrawingBrush.color = this.currentColor;
      }
      
      // 初期設定を適用
      this.setTool(this.currentTool);
      this.setColor(this.currentColor);
      this.setWidth(this.currentWidth);
      
      const canvasElement = canvas.getElement();
      if (canvasElement) {
        canvasElement.style.touchAction = 'none';
        canvasElement.style.border = '1px solid #ccc';
      }
      
      canvas.renderAll();
    } catch (error) {
      console.error('Canvas initialization error:', error);
      throw error;
    }
  }

  /**
   * Firebase同期を開始
   */
  startFirebaseSync(): Unsubscribe {
    const pathsRef = ref(db, `drawings/${this.context.sessionId}/paths`);
    
    this.firebaseUnsubscribe = onValue(pathsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const firebaseObjectIds = Object.keys(data);
          
          if (this.isInitialLoad) {
            // 初回ロード時：すべてのデータを復元
            firebaseObjectIds.forEach((pathId) => {
              this.restoreObject(data[pathId], pathId);
            });
            this.context.canvas.renderAll();
            this.isInitialLoad = false;
          } else {
            // 通常の更新時：新しいオブジェクトを追加、削除されたオブジェクトを削除
            
            // 新しいオブジェクトを追加
            firebaseObjectIds.forEach((pathId) => {
              if (!this.loadedPathIds.has(pathId)) {
                this.restoreObject(data[pathId], pathId);
              }
            });
            
            // 削除されたオブジェクトをキャンバスから削除
            const canvasObjects = this.context.canvas.getObjects();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            canvasObjects.forEach((obj: any) => {
              const firebaseId = obj.get('firebaseId');
              if (firebaseId && !firebaseObjectIds.includes(firebaseId)) {
                this.context.canvas.remove(obj);
                this.loadedPathIds.delete(firebaseId);
              }
            });
            
            this.context.canvas.renderAll();
          }
        } else {
          // データが完全に削除された場合（全消去）
          if (!this.isInitialLoad) {
            this.context.canvas.clear();
            this.loadedPathIds.clear();
            this.context.canvas.renderAll();
          }
          this.isInitialLoad = false;
        }
      } catch (error) {
        console.error('Data sync error:', error);
      }
    });
    
    return this.firebaseUnsubscribe;
  }

  /**
   * Firebase同期を停止
   */
  stopFirebaseSync(): void {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
  }

  /**
   * オブジェクトを復元
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private restoreObject(pathData: any, pathId: string): void {
    if (!pathId || !pathData || this.loadedPathIds.has(pathId)) return;
    
    try {
      let objectToAdd;
      const fabricLib = this.context.fabricLib;
      
      if (pathData.type === 'path' || pathData.type === 'Path') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FabricPath = (fabricLib as any).Path;
        if (FabricPath.fromObject) {
          const pathObjectOrPromise = FabricPath.fromObject(pathData);
          
          if (pathObjectOrPromise instanceof Promise) {
            pathObjectOrPromise.then((pathObject) => {
              if (pathObject) {
                this.configureRestoredPathObject(pathObject, pathData);
                this.addRestoredPathToCanvas(pathObject, pathId);
              }
            }).catch(() => {
              const cleanedData = this.cleanObjectData(pathData);
              const pathObject = new FabricPath(pathData.path, cleanedData);
              this.configureRestoredPathObject(pathObject, pathData);
              this.addRestoredPathToCanvas(pathObject, pathId);
            });
            return;
          } else {
            objectToAdd = pathObjectOrPromise;
          }
        } else {
          const cleanedData = this.cleanObjectData(pathData);
          objectToAdd = new FabricPath(pathData.path, cleanedData);
        }
      } else if (pathData.type === 'rect' || pathData.type === 'Rect') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FabricRect = (fabricLib as any).Rect;
        const cleanedData = this.cleanObjectData(pathData);
        objectToAdd = new FabricRect(cleanedData);
      } else if (pathData.type === 'circle' || pathData.type === 'Circle') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FabricCircle = (fabricLib as any).Circle;
        const cleanedData = this.cleanObjectData(pathData);
        objectToAdd = new FabricCircle(cleanedData);
      } else if (pathData.type === 'line' || pathData.type === 'Line') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FabricLine = (fabricLib as any).Line;
        const cleanedData = this.cleanObjectData(pathData);
        objectToAdd = new FabricLine([pathData.x1, pathData.y1, pathData.x2, pathData.y2], cleanedData);
      } else if (pathData.type === 'i-text' || pathData.type === 'IText') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const FabricIText = (fabricLib as any).IText;
        const cleanedData = this.cleanObjectData(pathData);
        objectToAdd = new FabricIText(pathData.text || '', cleanedData);
      }
      
      if (objectToAdd) {
        this.addRestoredPathToCanvas(objectToAdd, pathId);
      }
    } catch (error) {
      console.error('Object creation error for', pathId, ':', error);
    }
  }

  /**
   * 復元されたパスオブジェクトを設定
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private configureRestoredPathObject(pathObject: any, pathData: any): void {
    pathObject.set({
      fill: '',
      stroke: pathData.stroke || '#000000',
      strokeWidth: pathData.strokeWidth || 5
    });
  }

  /**
   * 復元されたパスをキャンバスに追加
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addRestoredPathToCanvas(pathObject: any, pathId: string): void {
    // FirebaseのIDをオブジェクトに保存
    (pathObject as fabric.Object & { firebaseId?: string }).firebaseId = pathId;
    this.context.canvas.add(pathObject);
    this.context.canvas.renderAll();
    this.loadedPathIds.add(pathId);
  }

  /**
   * オブジェクトデータをクリーンアップ
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cleanObjectData(data: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleaned: any = { ...data };
    // 読み取り専用プロパティを除去
    delete cleaned.type;
    delete cleaned.version;
    delete cleaned.originX;
    delete cleaned.originY;
    return cleaned;
  }

  /**
   * 描画色を設定
   */
  setColor(color: string): void {

    this.currentColor = color;
    this.updateBrushSettings();
    this.updatePreviewCommand();
  }

  /**
   * 描画幅を設定
   */
  setWidth(width: number): void {

    this.currentWidth = width;
    this.updateBrushSettings();
    this.updatePreviewCommand();
  }

  /**
   * プレビューを開始
   */
  startPreview(startPoint: { x: number; y: number }): fabric.Object | null {
    if (!['rectangle', 'circle', 'line'].includes(this.currentTool)) return null;

    if (this.previewCommand) {
      return this.previewCommand.createPreview(startPoint);
    }
    return null;
  }

  /**
   * プレビューを更新
   */
  updatePreview(startPoint: { x: number; y: number }, endPoint: { x: number; y: number }): void {
    if (this.previewCommand) {
      this.previewCommand.updatePreview(startPoint, endPoint);
    }
  }

  /**
   * プレビューを終了
   */
  endPreview(): void {
    if (this.previewCommand) {
      this.previewCommand.removePreview();
    }
  }

  /**
   * プレビューが存在するかチェック
   */
  hasPreview(): boolean {
    return this.previewCommand ? this.previewCommand.hasPreview() : false;
  }

  /**
   * 図形を描画
   */
  drawShape(startPoint: { x: number; y: number }, endPoint: { x: number; y: number }): void {
    if (!['rectangle', 'circle', 'line'].includes(this.currentTool)) return;

    const shapeData: DrawingData = {
      tool: this.currentTool,
      color: this.currentColor,
      width: this.currentWidth,
      startPoint,
      endPoint
    };

    const command = new ShapeCommand(this.context, shapeData);
    this.commandManager.executeCommand(command);
  }

  /**
   * テキストを追加
   */
  addText(point: { x: number; y: number }, text?: string): void {
    const textData: DrawingData = {
      tool: 'text',
      color: this.currentColor,
      width: this.currentWidth,
      startPoint: point,
      text
    };

    const command = new TextCommand(this.context, textData);
    this.commandManager.executeCommand(command);
  }

  /**
   * パス描画（ペン描画完了時に呼び出し）
   */
  addPath(pathData: Record<string, unknown>, objectId?: string): void {

    const command = new PathCommand(this.context, pathData, objectId);
    this.commandManager.executeCommand(command);
  }

  /**
   * 消しゴム操作
   */
  eraseObjects(eraserPath: fabric.Object): void {
    const command = new EraserCommand(this.context, eraserPath);
    this.commandManager.executeCommand(command);
  }

  /**
   * 全クリア
   */
  clearCanvas(): void {
    const command = new ClearCommand(this.context);
    this.commandManager.executeCommand(command);
  }

  /**
   * Undo操作
   */
  undo(): boolean {
    return this.commandManager.undo();
  }

  /**
   * Redo操作
   */
  redo(): boolean {
    return this.commandManager.redo();
  }

  /**
   * プレビューコマンドを更新
   */
  private updatePreviewCommand(): void {
    this.previewCommand = new PreviewCommand(
      this.context,
      this.currentTool,
      this.currentColor,
      this.currentWidth
    );
  }

  /**
   * キャンバスモードを更新
   */
  private updateCanvasMode(): void {
    const canvas = this.context.canvas;
    
    switch (this.currentTool) {
      case 'pen':
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.getElement().style.cursor = 'crosshair';
        break;
      case 'eraser':
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.getElement().style.cursor = 'crosshair';
        break;
      case 'select':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.skipTargetFind = false;
        canvas.getElement().style.cursor = 'default';
        break;
      case 'hand':
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.getElement().style.cursor = 'grab';
        break;
      default:
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.getElement().style.cursor = 'crosshair';
        break;
    }
  }

  /**
   * ブラシ設定を更新
   */
  private updateBrushSettings(): void {
    const canvas = this.context.canvas;
    
    if (canvas.freeDrawingBrush) {
      if (this.currentTool === 'eraser') {
        canvas.freeDrawingBrush.color = '#FFFFFF';
        canvas.freeDrawingBrush.width = this.currentWidth * 2;
      } else if (this.currentTool === 'pen') {
        canvas.freeDrawingBrush.color = this.currentColor;
        canvas.freeDrawingBrush.width = this.currentWidth;
      }
    }
  }

  /**
   * 現在の設定を取得
   */
  getCurrentSettings(): { tool: DrawingTool; color: string; width: number } {
    return {
      tool: this.currentTool,
      color: this.currentColor,
      width: this.currentWidth
    };
  }

  /**
   * コマンド履歴の情報を取得
   */
  getHistoryInfo(): { total: number; currentIndex: number; canUndo: boolean; canRedo: boolean } {
    return this.commandManager.getHistoryInfo();
  }

  /**
   * コマンド履歴をクリア
   */
  clearHistory(): void {
    this.commandManager.clearHistory();
  }
} 