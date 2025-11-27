export const formatTimerValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '--:--';
  }

  const safeSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
