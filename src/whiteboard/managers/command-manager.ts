import { Command } from '../types/command';

export class CommandManager {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * コマンドを実行し、履歴に追加
   */
  executeCommand(command: Command): void {
    try {
      command.execute();
      
      // 現在の位置より後の履歴を削除（新しいコマンドが実行された場合）
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }
      
      // 履歴に追加
      this.history.push(command);
      this.currentIndex++;
      
      // 履歴サイズの制限
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(-this.maxHistorySize);
        this.currentIndex = this.maxHistorySize - 1;
      }
      
      console.log(`Command executed: ${command.getType()}`);
    } catch (error) {
      console.error('Command execution error:', error);
    }
  }

  /**
   * 前のコマンドを取り消し
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    try {
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;
      
      console.log(`Command undone: ${command.getType()}`);
      return true;
    } catch (error) {
      console.error('Undo error:', error);
      return false;
    }
  }

  /**
   * 取り消したコマンドを再実行
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    try {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.execute();
      
      console.log(`Command redone: ${command.getType()}`);
      return true;
    } catch (error) {
      console.error('Redo error:', error);
      this.currentIndex--;
      return false;
    }
  }

  /**
   * Undoが可能かチェック
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Redoが可能かチェック
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * 履歴をクリア
   */
  clearHistory(): void {
    this.history = [];
    this.currentIndex = -1;
    console.log('Command history cleared');
  }

  /**
   * 履歴の統計情報を取得
   */
  getHistoryInfo(): { total: number; currentIndex: number; canUndo: boolean; canRedo: boolean } {
    return {
      total: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  /**
   * 履歴の詳細情報を取得（デバッグ用）
   */
  getHistoryDetails(): Array<{ type: string; data: Record<string, unknown> }> {
    return this.history.map(command => ({
      type: command.getType(),
      data: command.getData()
    }));
  }

  /**
   * 特定の種類のコマンドの数を取得
   */
  getCommandCount(commandType: string): number {
    return this.history.filter(command => command.getType() === commandType).length;
  }
} 