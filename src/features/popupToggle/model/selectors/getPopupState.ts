import { RootState } from '@app/providers/StoreProvider';

export const getPopupState = (state: RootState) => state.popup;
export const getIsPopupOpen = (state: RootState) => state.popup.isOpen;
