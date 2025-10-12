// src/components/Waveform/Waveform.tsx
import { useEffect, useRef } from 'react';

type Props = {
  /** Файл, по которому рисуем форму волны */
  src?: string;
  /** Вариант 1: берём прогресс из audio-элемента */
  clockEl?: HTMLAudioElement | null;
  /** Вариант 2: даём время вручную (например, из WebAudio-движка) */
  current?: number;
  duration?: number;

  height?: number;
  peaksCount?: number;

  /** Если не заданы — цвета подтянутся из CSS-переменных:
   * --wave-bars           (фоновые столбики)
   * --wave-bars-active    (заливка "сыгранной" части)
   */
  backgroundColor?: string;
  progressColor?: string;
};

export default function Waveform({
  src,
  clockEl,
  current,
  duration,
  height = 56,
  peaksCount = 900,
  backgroundColor,
  progressColor,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[] | null>(null);
  const decodedDurationRef = useRef<number>(0); // длительность из декодированного файла (для clockEl-режима)
  const rafRef = useRef<number | null>(null);

  // Загружаем и считаем пики
  useEffect(() => {
    if (!src) return;
    let aborted = false;

    (async () => {
      peaksRef.current = null;

      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ac = new AC();
      try {
        const resp = await fetch(src, { cache: 'force-cache' });
        const buf = await resp.arrayBuffer();
        const audio = await ac.decodeAudioData(buf);
        if (aborted) return;

        decodedDurationRef.current = audio.duration;

        // берём 1-й канал, считаем усреднённую амплитуду блоками
        const ch = audio.getChannelData(0);
        const block = Math.max(1, Math.floor(ch.length / peaksCount));
        const peaks = new Array(peaksCount).fill(0);

        for (let i = 0; i < peaksCount; i++) {
          let sum = 0;
          const start = i * block;
          const end = Math.min(start + block, ch.length);
          for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
          peaks[i] = sum / Math.max(1, end - start);
        }

        const max = Math.max(...peaks) || 1;
        peaksRef.current = peaks.map((v) => v / max);

        drawStatic();
      } catch (e) {
        // молча пропускаем — компонент просто ничего не нарисует
        // console.error(e);
      } finally {
        ac.close().catch(() => {});
      }
    })();

    return () => {
      aborted = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, peaksCount]);

  // Поддержка ресайза: перерисовать статику
  useEffect(() => {
    const onResize = () => drawStatic();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Анимация прогресса
  useEffect(() => {
    // если работаем от clockEl — запускаем RAF,
    // если от current/duration — тоже RAF (для «живой» линии)
    rafRef.current = requestAnimationFrame(drawProgress);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockEl, current, duration]);

  // ---- отрисовка ----

  const resolveColor = (cssVarName: string, fallback: string) => {
    const cvs = canvasRef.current;
    const el = cvs ?? document.documentElement;
    const val = getComputedStyle(el).getPropertyValue(cssVarName).trim();
    return val || fallback;
  };

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

    const bg = backgroundColor ?? resolveColor('--wave-bars', 'rgba(255,255,255,0.3)');
    ctx.fillStyle = bg;

    // Столбики (фон)
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

    // 1) Статика как подложка
    drawStatic();

    // 2) Считаем прогресс
    let prog = 0;
    if (typeof current === 'number' && typeof duration === 'number' && duration > 0) {
      prog = Math.min(1, Math.max(0, current / duration));
    } else if (clockEl && decodedDurationRef.current > 0) {
      prog = Math.min(1, Math.max(0, clockEl.currentTime / decodedDurationRef.current));
    }

    // 3) Подкрашиваем активную часть
    const w = cvs.width;
    const h = cvs.height;
    const cutoffX = Math.floor(w * prog);

    if (cutoffX > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cutoffX, h);
      ctx.clip();

      const mid = h / 2;
      const barW = w / peaks.length;

      const progCol = progressColor ?? resolveColor('--wave-bars-active', 'rgba(255,255,255,0.85)');
      ctx.fillStyle = progCol;

      for (let i = 0; i < peaks.length; i++) {
        const amp = peaks[i] * (h * 0.9) * 0.5;
        ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.9), amp * 2);
      }
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(drawProgress);
  };

  return (
    <div className="waveform" style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height }} />
    </div>
  );
}
