type AlbumsStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * Показывать ли полноэкранный скелетон/блокировку по статусу альбомов.
 * Пока в store уже есть данные для списка/альбома, не скрываем UI при loading/idle
 * (фоновый refetch из кабинета, закрытие дашборда во время загрузки и т.д.).
 */
export function useShowAlbumsLoadingShell(
  albumsStatus: AlbumsStatus,
  hasRenderableAlbumsData: boolean
): boolean {
  const waiting = albumsStatus === 'loading' || albumsStatus === 'idle';
  if (!waiting) return false;
  if (hasRenderableAlbumsData) return false;
  return true;
}
