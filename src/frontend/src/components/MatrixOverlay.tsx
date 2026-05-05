import { useEffect, useRef } from "react";

interface MatrixOverlayProps {
  visible: boolean;
}

export function MatrixOverlay({ visible }: MatrixOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 260;
    const H = 140;
    canvas.width = W;
    canvas.height = H;
    const cols = Math.floor(W / 12);
    const drops = Array(cols).fill(1);
    const chars = "01アイウエオカキABCDEF";
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#00ff41";
      ctx.font = "11px monospace";
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(
          chars[Math.floor(Math.random() * chars.length)],
          i * 12,
          drops[i] * 12,
        );
        if (drops[i] * 12 > H && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 right-3 z-[200] rounded-xl overflow-hidden shadow-2xl border border-green-500/30"
      style={{ width: 260, background: "rgba(0,0,0,0.88)" }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: 260, height: 140, display: "block" }}
        className="opacity-70"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <p className="text-green-400 font-mono text-[11px] tracking-widest animate-pulse">
          AI IS CODING...
        </p>
      </div>
    </div>
  );
}
