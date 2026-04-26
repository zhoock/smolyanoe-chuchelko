import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectAlbumsInFlightFetchContextKey } from '@entities/album';
import { useDashboardModalShell } from '@shared/lib/dashboardModalShellContext';

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

/**
 * Как `useShowAlbumsLoadingShell`, но не показываем «загрузку» на **фоновой** surface,
 * пока дашборд-оверлей в полёте тянет тот же глобальный `albums` (inFlight = dashboard).
 */
export function useShowAlbumsLoadingShellExcludingDashboardInFlight(baseShow: boolean): boolean {
  const inFlight = useAppSelector(selectAlbumsInFlightFetchContextKey);
  const { overlayOpen } = useDashboardModalShell();
  if (baseShow && overlayOpen && inFlight === 'dashboard') {
    return false;
  }
  return baseShow;
}

/** Всё вместе: скелетон по status + подавление на фоне при загрузке из дашборда. */
export function useShowSurfaceAlbumsLoadingShell(
  albumsStatus: AlbumsStatus,
  hasRenderableAlbumsData: boolean
): boolean {
  const base = useShowAlbumsLoadingShell(albumsStatus, hasRenderableAlbumsData);
  return useShowAlbumsLoadingShellExcludingDashboardInFlight(base);
}
