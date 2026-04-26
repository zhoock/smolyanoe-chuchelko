import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectArticlesInFlightFetchContextKey } from '@entities/article';
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
  const show = baseShow(articlesStatus, hasRenderableData);
  const inFlight = useAppSelector(selectArticlesInFlightFetchContextKey);
  const { overlayOpen } = useDashboardModalShell();
  if (show && overlayOpen && inFlight === 'dashboard') {
    return false;
  }
  return show;
}
