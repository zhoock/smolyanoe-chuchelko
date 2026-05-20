import type { AppDispatch } from '@shared/model/appStore/types';
import { resetAlbumsState } from '@entities/album';
import { resetArticlesState } from '@entities/article/model/articlesSlice';
import { setPublicArtistSlug } from '@shared/model/currentArtist';
import { clearDashboardModalBackground } from '@shared/lib/dashboardModalBackground';

/**
 * Сбрасывает публичный каталог и фон модального дашборда после logout / удаления аккаунта,
 * чтобы не оставался ?artist= удалённого пользователя и не ломался albumsLoader.
 */
export function resetCatalogAfterAuthEnd(dispatch: AppDispatch): void {
  dispatch(setPublicArtistSlug(null));
  dispatch(resetAlbumsState());
  dispatch(resetArticlesState());
  clearDashboardModalBackground();

  try {
    localStorage.removeItem('profile-name');
  } catch {
    /* ignore */
  }
}
