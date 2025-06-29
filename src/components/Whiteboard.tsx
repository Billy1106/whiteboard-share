'use client';

import { useWhiteboard } from '@/hooks/useWhiteboard';

interface WhiteboardProps {
  sessionId: string;
  userId: string;
}

export default function Whiteboard({ sessionId, userId }: WhiteboardProps) {
  const { canvasRef, setDrawingColor, setDrawingWidth } = useWhiteboard({ sessionId, userId });

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <button onClick={() => { setDrawingColor('#000000'); }} className="p-2 m-1 bg-black text-white rounded">黒</button>
        <button onClick={() => { setDrawingColor('#FF0000'); }} className="p-2 m-1 bg-red-500 text-white rounded">赤</button>
        <button onClick={() => { setDrawingColor('#0000FF'); }} className="p-2 m-1 bg-blue-500 text-white rounded">青</button>
        <input
          type="range"
          min="1"
          max="20"
          defaultValue="5"
          onChange={(e) => { setDrawingWidth(parseInt(e.target.value)); }}
          className="ml-4"
        />
      </div>
      <canvas ref={canvasRef} width={800} height={600} className="border border-gray-400"></canvas>
    </div>
  );
}
