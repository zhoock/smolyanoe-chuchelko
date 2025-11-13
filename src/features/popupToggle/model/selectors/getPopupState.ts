import { RootState } from '@shared/model/appStore/types';

export const getPopupState = (state: RootState) => state.popup;
export const getIsPopupOpen = (state: RootState) => state.popup.isOpen;
