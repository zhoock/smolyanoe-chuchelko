import type { configureStore, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';

import type { popupReducer } from '@features/popupToggle';
import type { playerReducer } from '@features/player';
import type { LangState } from '@shared/model/lang';
import type { ArticlesState } from '@entities/article/model/types';
import type { AlbumsState } from '@entities/album/model/types';
import type { UiDictionaryState } from '@shared/model/uiDictionary/types';

type PopupState = ReturnType<typeof popupReducer>;
type PlayerState = ReturnType<typeof playerReducer>;

export interface RootState {
  popup: PopupState;
  player: PlayerState;
  lang: LangState;
  articles: ArticlesState;
  albums: AlbumsState;
  uiDictionary: UiDictionaryState;
}

export type AppStore = ReturnType<typeof configureStore<RootState>>;
export type AppDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;
