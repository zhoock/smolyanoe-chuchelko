import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@shared/model/appStore/types';

export type CurrentArtistState = {
  /** Public site slug (?artist=); single source for public API `artist` query param. */
  publicSlug: string | null;
};

const initialState: CurrentArtistState = {
  publicSlug: null,
};

const currentArtistSlice = createSlice({
  name: 'currentArtist',
  initialState,
  reducers: {
    setPublicArtistSlug(state, action: PayloadAction<string | null>) {
      const raw = action.payload;
      const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      state.publicSlug = v.length > 0 ? v : null;
    },
  },
});

export const { setPublicArtistSlug } = currentArtistSlice.actions;
export const currentArtistReducer = currentArtistSlice.reducer;

export const selectPublicArtistSlug = (state: RootState): string | null =>
  state.currentArtist.publicSlug;
