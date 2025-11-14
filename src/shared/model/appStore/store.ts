import { configureStore } from '@reduxjs/toolkit';

import { popupReducer } from '@features/popupToggle';
import { playerReducer } from '@features/player';
import {
  playerListenerMiddleware,
  attachAudioEvents,
} from '@features/player/model/middleware/playerListeners';
import { langReducer, langListenerMiddleware, applyLangSideEffects } from '@shared/model/lang';
import { articlesReducer } from '@entities/article';

import type { AppDispatch, AppStore as AppStoreType, RootState } from './types';

const rootReducer = {
  popup: popupReducer,
  player: playerReducer,
  lang: langReducer,
  articles: articlesReducer,
};

let storeInstance: AppStoreType | null = null;

export const createReduxStore = (): AppStoreType => {
  if (storeInstance) {
    return storeInstance;
  }

  const store = configureStore({
    reducer: rootReducer,
    devTools: process.env.NODE_ENV !== 'production',
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        playerListenerMiddleware.middleware,
        langListenerMiddleware.middleware
      ),
  });

  attachAudioEvents(store.dispatch as AppDispatch, store.getState as () => RootState);
  applyLangSideEffects(store.getState().lang.current);

  storeInstance = store;

  return store;
};

export const getStore = (): AppStoreType => createReduxStore();
