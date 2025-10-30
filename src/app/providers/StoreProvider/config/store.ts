import { configureStore } from '@reduxjs/toolkit';
import { popupReducer } from '@features/popupToggle';

const rootReducer = {
  popup: popupReducer,
};

export function createReduxStore() {
  return configureStore({
    reducer: rootReducer,
    devTools: process.env.NODE_ENV !== 'production',
  });
}

export type AppStore = ReturnType<typeof createReduxStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
