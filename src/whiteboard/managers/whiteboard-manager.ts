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

export class WhiteboardManager {
  private commandManager: CommandManager;
  private context: DrawingContext;
  private previewCommand: PreviewCommand | null = null;
  private currentTool: DrawingTool = 'pen';
  private currentColor: string = '#000000';
  private currentWidth: number = 5;

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