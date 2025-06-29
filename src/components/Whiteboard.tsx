'use client';

import { useWhiteboard, DrawingTool } from '@/hooks/useWhiteboard';

interface WhiteboardProps {
  sessionId: string;
  userId: string;
}

const colors = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB',
  '#A52A2A', '#808080', '#FFFFFF'
];

const tools: { id: DrawingTool; name: string; icon: string }[] = [
  { id: 'pen', name: 'ペン', icon: '🖊️' },
  { id: 'eraser', name: '消しゴム', icon: '🧹' },
  { id: 'rectangle', name: '長方形', icon: '⬜' },
  { id: 'circle', name: '円', icon: '⭕' },
  { id: 'line', name: '直線', icon: '📏' },
  { id: 'text', name: 'テキスト', icon: '📝' },
  { id: 'select', name: '選択', icon: '👆' },
];

export default function Whiteboard({ sessionId, userId }: WhiteboardProps) {
  const { 
    canvasRef, 
    isCanvasReady, 
    currentTool,
    drawingColor,
    drawingWidth,
    setTool,
    setDrawingColor, 
    setDrawingWidth,
    clearCanvas,
    undo
  } = useWhiteboard({ sessionId, userId });

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* ツールバー */}
      <div className="bg-white p-4 rounded-lg shadow-lg border">
        {/* 描画ツール */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">描画ツール</h3>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentTool === tool.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={tool.name}
              >
                <span className="mr-1">{tool.icon}</span>
                {tool.name}
              </button>
            ))}
          </div>
        </div>

        {/* 色選択 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">色選択</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setDrawingColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  drawingColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <input
              type="color"
              value={drawingColor}
              onChange={(e) => setDrawingColor(e.target.value)}
              className="w-8 h-8 rounded-full border-2 border-gray-300 cursor-pointer"
              title="カスタム色"
              aria-label="カスタム色選択"
            />
          </div>
        </div>

        {/* 線の太さ */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">線の太さ: {drawingWidth}px</h3>
          <input
            type="range"
            min="1"
            max="50"
            value={drawingWidth}
            onChange={(e) => setDrawingWidth(parseInt(e.target.value))}
            className="w-full"
            aria-label="線の太さ調整"
          />
        </div>

        {/* 操作ボタン */}
        <div>
          <h3 className="text-sm font-semibold mb-2">操作</h3>
          <div className="flex gap-2">
            <button
              onClick={undo}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
            >
              ↶ 元に戻す
            </button>
            <button
              onClick={clearCanvas}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              🗑️ 全消去
            </button>
          </div>
        </div>
      </div>

      {/* キャンバス */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          className={`border-2 border-gray-300 rounded-md ${
            !isCanvasReady ? 'opacity-50' : ''
          }`}
        />
        {!isCanvasReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        )}
      </div>

      {/* ツール説明 */}
      <div className="bg-gray-50 p-4 rounded-lg max-w-4xl">
        <h3 className="text-sm font-semibold mb-2">使い方</h3>
        <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
          <div><strong>ペン:</strong> 自由に描画</div>
          <div><strong>消しゴム:</strong> 描画を消去</div>
          <div><strong>長方形:</strong> ドラッグして長方形を描画</div>
          <div><strong>円:</strong> ドラッグして円を描画</div>
          <div><strong>直線:</strong> ドラッグして直線を描画</div>
          <div><strong>テキスト:</strong> クリックしてテキスト入力</div>
          <div><strong>選択:</strong> オブジェクトを選択・移動</div>
          <div><strong>全消去:</strong> キャンバス全体をクリア</div>
        </div>
      </div>
    </div>
  );
}
