import { createSlice } from '@reduxjs/toolkit';

interface PopupState {
  isOpen: boolean;
}

const initialState: PopupState = {
  isOpen: false,
};

const popupSlice = createSlice({
  name: 'popup',
  initialState,
  reducers: {
    open(state) {
      state.isOpen = true;
    },
    close(state) {
      state.isOpen = false;
    },
    toggle(state) {
      state.isOpen = !state.isOpen;
    },
  },
});

export const { open: openPopup, close: closePopup, toggle: togglePopup } = popupSlice.actions;
export const popupReducer = popupSlice.reducer;
