'use client';

import { useWhiteboardContext } from '@/contexts/WhiteboardContext';
import { DrawingTool } from '@/whiteboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  PenTool, 
  Eraser, 
  Square, 
  Circle, 
  Minus, 
  Type, 
  MousePointer, 
  Undo2, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Hand
} from 'lucide-react';
import { useState } from 'react';

const colors = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB',
  '#A52A2A', '#808080', '#FFFFFF'
];

const tools = [
  { id: 'pen' as DrawingTool, name: 'ペン', icon: <PenTool className="w-5 h-5" /> },
  { id: 'eraser' as DrawingTool, name: '消しゴム', icon: <Eraser className="w-5 h-5" /> },
  { id: 'rectangle' as DrawingTool, name: '長方形', icon: <Square className="w-5 h-5" /> },
  { id: 'circle' as DrawingTool, name: '円', icon: <Circle className="w-5 h-5" /> },
  { id: 'line' as DrawingTool, name: '直線', icon: <Minus className="w-5 h-5" /> },
  { id: 'text' as DrawingTool, name: 'テキスト', icon: <Type className="w-5 h-5" /> },
  { id: 'select' as DrawingTool, name: '選択', icon: <MousePointer className="w-5 h-5" /> },
  { id: 'hand' as DrawingTool, name: '移動', icon: <Hand className="w-5 h-5" /> },
];

export default function DrawingToolbar() {
  const {
    currentTool,
    drawingColor,
    drawingWidth,
    zoomLevel,
    setTool,
    setDrawingColor,
    setDrawingWidth,
    clearCanvas,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom
  } = useWhiteboardContext();

  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

  return (
    <>
      {/* フローティングツールバー */}
      <div className={`fixed top-4 left-4 z-10 transition-transform duration-300 ${
        isToolbarCollapsed ? '-translate-x-64' : 'translate-x-0'
      }`}>
        <Card className="w-80 max-h-[calc(100vh-2rem)] overflow-auto shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              描画ツール
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 描画ツール */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">ツール</Label>
              <ToggleGroup 
                type="single" 
                value={currentTool} 
                onValueChange={(value: DrawingTool) => value && setTool(value)}
                className="grid grid-cols-2 gap-2"
              >
                {tools.map((tool) => (
                  <ToggleGroupItem
                    key={tool.id}
                    value={tool.id}
                    aria-label={tool.name}
                    className="flex flex-col items-center gap-1 p-3 h-auto"
                  >
                    {tool.icon}
                    <span className="text-xs">{tool.name}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <Separator />

            {/* 色選択 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">色</Label>
              <div className="grid grid-cols-6 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setDrawingColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      drawingColor === color ? 'border-blue-500 scale-110 ring-2 ring-blue-200' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={drawingColor}
                onChange={(e) => setDrawingColor(e.target.value)}
                className="w-full h-8 rounded-md border border-gray-300 cursor-pointer"
                title="カスタム色"
              />
            </div>

            <Separator />

            {/* 線の太さ */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">太さ: {drawingWidth}px</Label>
              <Slider
                value={[drawingWidth]}
                onValueChange={(value) => setDrawingWidth(value[0])}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1px</span>
                <span>50px</span>
              </div>
            </div>

            <Separator />

            {/* ズーム機能 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">ズーム: {Math.round(zoomLevel * 100)}%</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={zoomIn}
                  variant="outline"
                  className="flex items-center gap-1"
                  size="sm"
                >
                  <ZoomIn className="w-3 h-3" />
                  拡大
                </Button>
                <Button
                  onClick={zoomOut}
                  variant="outline"
                  className="flex items-center gap-1"
                  size="sm"
                >
                  <ZoomOut className="w-3 h-3" />
                  縮小
                </Button>
                <Button
                  onClick={resetZoom}
                  variant="outline"
                  className="flex items-center gap-1"
                  size="sm"
                >
                  <RotateCcw className="w-3 h-3" />
                  リセット
                </Button>
              </div>
            </div>

            <Separator />

            {/* 操作ボタン */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">操作</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={undo}
                  variant="outline"
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Undo2 className="w-4 h-4" />
                  元に戻す
                </Button>
                <Button
                  onClick={clearCanvas}
                  variant="destructive"
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                  全消去
                </Button>
              </div>
              <Button
                onClick={redo}
                variant="outline"
                className="flex items-center gap-2 w-full"
                size="sm"
              >
                やり直し
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ツールバー展開ボタン（折りたたまれている時） */}
      {isToolbarCollapsed && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsToolbarCollapsed(false)}
          className="fixed top-4 left-4 z-10 h-10 w-10 p-0 shadow-lg"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </>
  );
} 