// src/components/Waveform/Waveform.tsx
import { useEffect, useRef } from 'react';

type Clock =
  | { currentTime: () => number; duration: () => number } // из StemEngine
  | undefined;

type Props = {
  /** Файл, по которому рисуем форму волны */
  src?: string;
  /** Старый способ: HTMLAudioElement (оставлен для совместимости) */
  clockEl?: HTMLAudioElement | null;
  /** Новый способ: часы от StemEngine */
  clock?: Clock;
  height?: number;
  peaksCount?: number;
  backgroundColor?: string;
  progressColor?: string;
};

export default function Waveform({
  src,
  clockEl,
  clock,
  height = 56,
  peaksCount = 900,
  backgroundColor = 'var(--wave-bars)',
  progressColor = 'var(--wave-bars-active)',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[] | null>(null);
  const durationRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // загрузка и расчёт пиков
  useEffect(() => {
    if (!src) return;
    let aborted = false;

    (async () => {
      peaksRef.current = null;
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
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
        const start = i * block;
        const end = Math.min(start + block, ch.length);
        for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
        peaks[i] = sum / (end - start);
      }

      const max = Math.max(...peaks) || 1;
      peaksRef.current = peaks.map((v) => v / max);

      drawStatic();
      ac.close();
    })().catch(console.error);

    return () => {
      aborted = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, peaksCount]);

  const drawStatic = () => {
    const cvs = canvasRef.current;
    const peaks = peaksRef.current;
    if (!cvs || !peaks) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, cvs.clientWidth * dpr);
    const h = Math.max(1, cvs.clientHeight * dpr);
    cvs.width = w;
    cvs.height = h;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const mid = h / 2;
    const barW = w / peaks.length;

    ctx.fillStyle = backgroundColor;
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * (h * 0.9) * 0.5;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
    }
  };

  const drawProgress = () => {
    const cvs = canvasRef.current;
    const peaks = peaksRef.current;
    if (!cvs || !peaks) return;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    drawStatic(); // перерисовать фон
    const w = cvs.width;
    const h = cvs.height;

    // приоритет — clock (из StemEngine), иначе clockEl
    const cur = clock?.currentTime() ?? (clockEl ? clockEl.currentTime : 0);

    const dur =
      clock?.duration() ??
      (Number.isFinite(clockEl?.duration ?? NaN)
        ? (clockEl!.duration as number)
        : durationRef.current);

    const progress = dur > 0 ? Math.min(1, Math.max(0, cur / dur)) : 0;

    const cutoffX = Math.floor(w * progress);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cutoffX, h);
    ctx.clip();

    const mid = h / 2;
    const barW = w / peaks.length;
    ctx.fillStyle = progressColor;
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * (h * 0.9) * 0.5;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
    }
    ctx.restore();

    rafRef.current = requestAnimationFrame(drawProgress);
  };

  // старт анимации — при появлении clock/clockEl
  useEffect(() => {
    if (!clock && !clockEl) return;
    rafRef.current = requestAnimationFrame(drawProgress);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, clockEl]);

  useEffect(() => {
    const onResize = () => drawStatic();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="waveform" style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height }} />
    </div>
  );
}
