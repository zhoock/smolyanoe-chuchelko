import { useCallback } from 'react';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { playerActions } from '@features/player';
import { trackDebug } from '../utils/debug';

interface UsePlayerTogglesParams {
  showLyrics: boolean;
  setShowLyrics: (value: boolean) => void;
  suppressScrollHandlingUntilRef: React.MutableRefObject<number>;
  ignoreActivityUntilRef: React.MutableRefObject<number>;
}

/**
 * Хук для переключения режимов плеера (toggleLyrics, toggleShuffle, toggleRepeat)
 */
export function usePlayerToggles({
  showLyrics,
  setShowLyrics,
  suppressScrollHandlingUntilRef,
  ignoreActivityUntilRef,
}: UsePlayerTogglesParams) {
  const dispatch = useAppDispatch();

  /**
   * Переключатель показа/скрытия текста
   */
  const toggleLyrics = useCallback(() => {
    trackDebug('toggleLyrics');

    const next = !showLyrics;
    trackDebug('toggleLyrics:result', { next });

    suppressScrollHandlingUntilRef.current = Date.now() + 2000;
    ignoreActivityUntilRef.current = Date.now() + 600;

    // Обновляем состояние синхронно
    setShowLyrics(next);
    dispatch(playerActions.setShowLyrics(next));
  }, [dispatch, showLyrics, setShowLyrics, suppressScrollHandlingUntilRef, ignoreActivityUntilRef]);

  /**
   * Переключатель режима перемешивания треков
   */
  const toggleShuffle = useCallback(() => {
    dispatch(playerActions.toggleShuffle());
  }, [dispatch]);

  /**
   * Переключатель режима зацикливания треков
   */
  const toggleRepeat = useCallback(() => {
    dispatch(playerActions.toggleRepeat());
  }, [dispatch]);

  return {
    toggleLyrics,
    toggleShuffle,
    toggleRepeat,
  };
}
