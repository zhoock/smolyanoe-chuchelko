import { configureStore } from '@reduxjs/toolkit';
import { popupReducer } from '@features/popupToggle';
import { playerReducer } from '@features/player';
import {
  playerListenerMiddleware,
  attachAudioEvents,
} from '@features/player/model/middleware/playerListeners';

const rootReducer = {
  popup: popupReducer,
  player: playerReducer,
};

// Явно определяем RootState на основе редьюсеров
export type RootState = {
  popup: ReturnType<typeof popupReducer>;
  player: ReturnType<typeof playerReducer>;
};

export function createReduxStore(): ReturnType<typeof configureStore> {
  const store = configureStore({
    reducer: rootReducer,
    devTools: process.env.NODE_ENV !== 'production',
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(playerListenerMiddleware.middleware),
  });
  // Attach audio element event listeners
  attachAudioEvents(store.dispatch, store.getState);
  return store;
}

export type AppStore = ReturnType<typeof createReduxStore>;
export type AppDispatch = AppStore['dispatch'];
