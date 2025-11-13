import { configureStore } from '@reduxjs/toolkit';
import { popupReducer } from '@features/popupToggle';
import { playerReducer } from '@features/player';
import {
  playerListenerMiddleware,
  attachAudioEvents,
} from '@features/player/model/middleware/playerListeners';
import type { AppDispatch, RootState } from './types';

const rootReducer = {
  popup: popupReducer,
  player: playerReducer,
};

export const createReduxStore = () => {
  const store = configureStore({
    reducer: rootReducer,
    devTools: process.env.NODE_ENV !== 'production',
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(playerListenerMiddleware.middleware),
  });

  attachAudioEvents(store.dispatch as AppDispatch, store.getState as () => RootState);

  return store;
};

export type AppStore = ReturnType<typeof createReduxStore>;
