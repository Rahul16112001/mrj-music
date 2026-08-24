import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  className?: string;
  accentColor?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  barCount = 28,
  className = '',
  accentColor = '#ff0000',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const barHeightsRef = useRef<number[]>(new Array(barCount).fill(4));
  const targetHeightsRef = useRef<number[]>(new Array(barCount).fill(4));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      frame++;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const spacing = 3;
      const totalSpacing = (barCount - 1) * spacing;
      const barWidth = Math.max(2, (width - totalSpacing) / barCount);

      // Periodically generate new targets when playing
      if (isPlaying && frame % 4 === 0) {
        for (let i = 0; i < barCount; i++) {
          // Symmetric wave pattern with rhythm peaks
          const midDist = Math.abs(i - barCount / 2) / (barCount / 2);
          const bell = Math.cos(midDist * Math.PI * 0.5);
          const rand = Math.random() * 0.7 + 0.3;
          targetHeightsRef.current[i] = Math.max(4, height * bell * rand * 0.95);
        }
      } else if (!isPlaying) {
        for (let i = 0; i < barCount; i++) {
          targetHeightsRef.current[i] = 4;
        }
      }

      // Smooth interpolation
      for (let i = 0; i < barCount; i++) {
        barHeightsRef.current[i] += (targetHeightsRef.current[i] - barHeightsRef.current[i]) * 0.25;
        const barH = barHeightsRef.current[i];
        const x = i * (barWidth + spacing);
        const y = (height - barH) / 2;

        // Gradient coloring with glow
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#ff4e4e');
        grad.addColorStop(0.5, accentColor);
        grad.addColorStop(1, '#ff1a1a');

        ctx.fillStyle = grad;
        ctx.beginPath();
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, barH, [radius]);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, barCount, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={32}
      className={`w-full max-w-[240px] h-8 pointer-events-none opacity-85 ${className}`}
    />
  );
};
