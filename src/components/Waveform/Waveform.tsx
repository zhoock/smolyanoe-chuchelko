// src/components/Waveform/Waveform.tsx
import { useEffect, useRef } from 'react';

type Props = {
  src?: string;
  clockEl?: HTMLAudioElement | null; // нужен для прогресса
  height?: number;
  peaksCount?: number;
};

export default function Waveform({ src, clockEl, height = 56, peaksCount = 900 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[] | null>(null);
  const durationRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const readVar = (name: string, fallback: string) => {
    const el = canvasRef.current?.parentElement ?? document.documentElement;
    const val = getComputedStyle(el).getPropertyValue(name).trim();
    return val || fallback;
  };

  // загрузка/расчёт пиков
  useEffect(() => {
    if (!src) return;
    let aborted = false;

    (async () => {
      peaksRef.current = null;

      const AC = (window.AudioContext ||
        // @ts-ignore
        window.webkitAudioContext) as typeof AudioContext;
      const ac = new AC();

      const resp = await fetch(src, { cache: 'force-cache' });
      const buf = await resp.arrayBuffer();
      const audio = await ac.decodeAudioData(buf);
      if (aborted) return;

      durationRef.current = audio.duration;

      const ch = audio.getChannelData(0);
      const block = Math.max(1, Math.floor(ch.length / peaksCount));
      const peaks = new Array(peaksCount).fill(0);
      for (let i = 0; i < peaksCount; i++) {
        let sum = 0;
        const s = i * block;
        const e = Math.min(s + block, ch.length);
        for (let j = s; j < e; j++) sum += Math.abs(ch[j]);
        peaks[i] = sum / Math.max(1, e - s);
      }
      const max = Math.max(...peaks) || 1;
      peaksRef.current = peaks.map((v) => v / max);

      drawStatic();
      ac.close();
      if (clockEl) loop(); // запустить перекраску прогресса, если есть часы
    })().catch(console.error);

    return () => {
      aborted = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, peaksCount]);

  // перерисовка на ресайз/смену темы
  useEffect(() => {
    const onResize = () => drawStatic();
    const mo = new MutationObserver(drawStatic);
    window.addEventListener('resize', onResize);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('resize', onResize);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // перезапуск RAF при смене clockEl
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (clockEl) loop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockEl]);

  const drawStatic = () => {
    const cvs = canvasRef.current;
    const peaks = peaksRef.current;
    if (!cvs || !peaks) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(cvs.clientWidth * dpr));
    const h = Math.max(1, Math.floor(cvs.clientHeight * dpr));
    cvs.width = w;
    cvs.height = h;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const mid = h / 2;
    const barW = w / peaks.length;

    ctx.fillStyle = readVar('--wave-bars', 'rgba(255,255,255,0.55)');
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * (h * 0.9) * 0.5;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
    }
  };

  // перекраска баров до прогресса активным цветом
  const drawActiveUpToProgress = () => {
    const cvs = canvasRef.current;
    const peaks = peaksRef.current;
    if (!cvs || !peaks) return;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const w = cvs.width;
    const h = cvs.height;
    const mid = h / 2;
    const barW = w / peaks.length;

    const dur = durationRef.current || clockEl?.duration || 0;
    const cur = clockEl?.currentTime || 0;
    const progress = dur > 0 ? Math.min(1, Math.max(0, cur / dur)) : 0;

    const cutoffX = Math.floor(w * progress);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cutoffX, h);
    ctx.clip();

    ctx.fillStyle = readVar('--wave-bars-active', 'var(--dark-greenish-yellow, #998238)');
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * (h * 0.9) * 0.5;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
    }
    ctx.restore();
  };

  const loop = () => {
    // рисуем фон (мог измениться DPI/тема) и актив до прогресса
    drawStatic();
    drawActiveUpToProgress();
    rafRef.current = requestAnimationFrame(loop);
  };

  return (
    <div className="waveform" style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height }} />
    </div>
  );
}
