'use client';

import { WhiteboardProvider, useWhiteboardContext } from '@/contexts/WhiteboardContext';
import DrawingToolbar from '@/components/DrawingToolbar';

interface WhiteboardProps {
  sessionId: string;
  userId: string;
}

function WhiteboardCanvas() {
  const { canvasRef, isCanvasReady, currentTool, drawingColor, drawingWidth, zoomLevel } = useWhiteboardContext();

  const getToolDisplayName = (tool: string) => {
    const toolNames: Record<string, string> = {
      'pen': 'ペン',
      'eraser': '消しゴム',
      'rectangle': '長方形',
      'circle': '円',
      'line': '直線',
      'text': 'テキスト',
      'select': '選択',
      'hand': '移動'
    };
    return toolNames[tool] || tool;
  };

  return (
    <div className="fixed inset-0 bg-gray-100">
      {/* 描画ツールバー */}
      <DrawingToolbar />

      {/* メインキャンバス */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="relative w-full bg-white  h-full max-w-full max-h-full">
          <canvas 
            ref={canvasRef} 
            width={1500} 
            height={800} 
            className={`w-full h-full border-2 border-gray-300 rounded-lg shadow-lg ${
              !isCanvasReady ? 'opacity-50' : ''
            }`}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
          {!isCanvasReady && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg">
              <div className="text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600"></div>
                <span className="text-lg">読み込み中...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 現在の状態表示 */}
      <div className="fixed bottom-4 right-4 z-10 rounded-lg shadow-lg p-3 border">
        <div className="text-xs text-gray-600 space-y-1">
          <div><strong>{getToolDisplayName(currentTool)}:</strong> アクティブなツール</div>
          <div className="flex items-center gap-2">
            色: <span className="w-3 h-3 rounded-full border" style={{backgroundColor: drawingColor}}></span>
          </div>
          <div>太さ: {drawingWidth}px</div>
          <div>ズーム: {Math.round(zoomLevel * 100)}%</div>
        </div>
      </div>
    </div>
  );
}

export default function Whiteboard({ sessionId, userId }: WhiteboardProps) {
  return (
    <WhiteboardProvider sessionId={sessionId} userId={userId}>
      <WhiteboardCanvas />
    </WhiteboardProvider>
  );
}
