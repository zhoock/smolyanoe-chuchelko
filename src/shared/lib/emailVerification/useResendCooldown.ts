import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'email-verification-resend-cooldown-until';
const DEFAULT_SECONDS = 60;

function readCooldownUntil(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeCooldownUntil(until: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(until));
  } catch {
    /* ignore */
  }
}

export function useResendCooldown(seconds = DEFAULT_SECONDS) {
  const [remaining, setRemaining] = useState(() => {
    const until = readCooldownUntil();
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  });

  useEffect(() => {
    const tick = () => {
      const until = readCooldownUntil();
      setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const startCooldown = useCallback(
    (overrideSeconds?: number) => {
      const duration = overrideSeconds ?? seconds;
      const until = Date.now() + duration * 1000;
      writeCooldownUntil(until);
      setRemaining(duration);
    },
    [seconds]
  );

  return { remaining, isCoolingDown: remaining > 0, startCooldown };
}
