import type { configureStore, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { popupReducer } from '@features/popupToggle';
import type { playerReducer } from '@features/player';

type PopupState = ReturnType<typeof popupReducer>;
type PlayerState = ReturnType<typeof playerReducer>;

export interface RootState {
  popup: PopupState;
  player: PlayerState;
}

export type AppStore = ReturnType<typeof configureStore<RootState>>;
export type AppDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;
