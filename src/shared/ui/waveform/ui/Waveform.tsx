// src/shared/ui/waveform/ui/Waveform.tsx
import { useEffect, useRef } from 'react';

type Props = {
  /** Файл, по которому строим пики */
  src?: string;
  /** Прогресс 0..1 (даёт страница/движок) */
  progress?: number;
  height?: number;
  peaksCount?: number;
};

export default function Waveform({ src, progress = 0, height = 56, peaksCount = 900 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[] | null>(null);

  // загрузка/расчёт пиков
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

      draw(progress); // первый рендер
      ac.close();
    })().catch(console.error);

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, peaksCount]);

  // ресайз → перерисовать
  useEffect(() => {
    const onResize = () => draw(progress);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // любое изменение progress → перерисовать
  useEffect(() => {
    draw(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const readColors = (el: HTMLElement) => {
    const cs = getComputedStyle(el);
    const bg = cs.getPropertyValue('--wave-bars').trim() || 'rgb(255 255 255 / 35%)';
    const act = cs.getPropertyValue('--wave-bars-active').trim() || 'rgb(255 255 255 / 82%)';
    return { bg, act };
  };

  const draw = (p: number) => {
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

    const { bg, act } = readColors(cvs);

    const mid = h / 2;
    const barW = w / peaks.length;

    // фоновые бары
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * (h * 0.9) * 0.5;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
    }

    // активная часть
    const cutoff = Math.floor(peaks.length * Math.min(1, Math.max(0, p)));
    ctx.fillStyle = act;
    for (let i = 0; i < cutoff; i++) {
      const amp = peaks[i] * (h * 0.9) * 0.5;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
    }
  };

  return (
    <div className="waveform" style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height }} />
    </div>
  );
}
