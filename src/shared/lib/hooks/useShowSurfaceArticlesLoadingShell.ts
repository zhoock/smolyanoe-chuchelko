import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectArticlesInFlightFetchContextKey } from '@entities/article';
import { selectCatalogArtistMissing } from '@entities/album';
import { useDashboardModalShell } from '@shared/lib/dashboardModalShellContext';

type ArticlesStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * Скелетон статей на главной: не мигать, пока дашборд в полёте качает тот же slice (inFlight = dashboard).
 */
function baseShow(status: ArticlesStatus, hasRenderableData: boolean): boolean {
  const waiting = status === 'loading' || status === 'idle';
  if (!waiting) return false;
  if (hasRenderableData) return false;
  return true;
}

export function useShowSurfaceArticlesLoadingShell(
  articlesStatus: ArticlesStatus,
  hasRenderableData: boolean
): boolean {
  const artistMissing = useAppSelector(selectCatalogArtistMissing);
  const inFlight = useAppSelector(selectArticlesInFlightFetchContextKey);
  const { overlayOpen } = useDashboardModalShell();

  if (artistMissing) return false;

  const show = baseShow(articlesStatus, hasRenderableData);
  if (show && overlayOpen && inFlight === 'dashboard') {
    return false;
  }
  return show;
}
