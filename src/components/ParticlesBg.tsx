import { useEffect, useRef } from "react";

/**
 * Fundo de partículas minimalistas (canvas puro, sem dependências).
 * Transparente — desenha por cima do que estiver atrás (ex.: foto).
 * Dimensiona-se ao elemento pai (que deve ser position:relative).
 * pointerEvents:none — não bloqueia cliques no conteúdo acima.
 */
export default function ParticlesBg({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let parts: { x: number; y: number; dx: number; dy: number; s: number }[] = [];
    const mouse: { x: number | null; y: number | null; r: number } = { x: null, y: null, r: 130 };

    const init = () => {
      parts = [];
      const n = Math.min(48, (canvas.width * canvas.height) / 17000);
      for (let i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          dx: Math.random() * 0.3 - 0.15,
          dy: Math.random() * 0.3 - 0.15,
          s: Math.random() * 1.6 + 0.7,
        });
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      init();
    };

    const step = () => {
      raf = requestAnimationFrame(step);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        if (p.x > canvas.width || p.x < 0) p.dx = -p.dx;
        if (p.y > canvas.height || p.y < 0) p.dy = -p.dy;
        if (mouse.x != null && mouse.y != null) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < mouse.r && d > 0) {
            p.x -= (dx / d) * ((mouse.r - d) / mouse.r) * 3;
            p.y -= (dy / d) * ((mouse.r - d) / mouse.r) * 3;
          }
        }
        p.x += p.dx;
        p.y += p.dy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245,200,120,0.55)";
        ctx.fill();
      }
      for (let a = 0; a < parts.length; a++) {
        for (let b = a; b < parts.length; b++) {
          const dd = (parts[a].x - parts[b].x) ** 2 + (parts[a].y - parts[b].y) ** 2;
          if (dd < 13000) {
            const o = 1 - dd / 13000;
            ctx.strokeStyle = `rgba(230,215,180,${o * 0.28})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(parts[a].x, parts[a].y);
            ctx.lineTo(parts[b].x, parts[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    resize();
    step();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
