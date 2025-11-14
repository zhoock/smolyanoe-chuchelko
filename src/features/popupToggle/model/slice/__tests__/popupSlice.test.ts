import { describe, test, expect } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { popupReducer, openPopup, closePopup, togglePopup } from '../popupSlice';
import { getPopupState, getIsPopupOpen } from '../../selectors/getPopupState';
import type { RootState } from '@shared/model/appStore/types';

describe('popupSlice', () => {
  describe('reducer', () => {
    test('должен возвращать начальное состояние', () => {
      const state = popupReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        isOpen: false,
      });
    });
  });

  describe('open action', () => {
    test('должен открыть попап из закрытого состояния', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(openPopup());

      expect(store.getState().popup.isOpen).toBe(true);
    });

    test('должен оставить попап открытым если он уже открыт', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
        preloadedState: {
          popup: {
            isOpen: true,
          },
        },
      });

      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(openPopup());

      expect(store.getState().popup.isOpen).toBe(true);
    });
  });

  describe('close action', () => {
    test('должен закрыть попап из открытого состояния', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
        preloadedState: {
          popup: {
            isOpen: true,
          },
        },
      });

      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(closePopup());

      expect(store.getState().popup.isOpen).toBe(false);
    });

    test('должен оставить попап закрытым если он уже закрыт', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(closePopup());

      expect(store.getState().popup.isOpen).toBe(false);
    });
  });

  describe('toggle action', () => {
    test('должен открыть попап из закрытого состояния', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(togglePopup());

      expect(store.getState().popup.isOpen).toBe(true);
    });

    test('должен закрыть попап из открытого состояния', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
        preloadedState: {
          popup: {
            isOpen: true,
          },
        },
      });

      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(togglePopup());

      expect(store.getState().popup.isOpen).toBe(false);
    });

    test('должен переключать состояние при множественных вызовах', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(true);
    });
  });

  describe('selectors', () => {
    test('getPopupState должен вернуть весь стейт попапа', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      const state = store.getState() as RootState;
      expect(getPopupState(state)).toEqual({ isOpen: false });

      store.dispatch(openPopup());

      const newState = store.getState() as RootState;
      expect(getPopupState(newState)).toEqual({ isOpen: true });
    });

    test('getIsPopupOpen должен вернуть false для закрытого попапа', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      const state = store.getState() as RootState;
      expect(getIsPopupOpen(state)).toBe(false);
    });

    test('getIsPopupOpen должен вернуть true для открытого попапа', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
        preloadedState: {
          popup: {
            isOpen: true,
          },
        },
      });

      const state = store.getState() as RootState;
      expect(getIsPopupOpen(state)).toBe(true);
    });

    test('getIsPopupOpen должен обновляться при изменении состояния', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      let state = store.getState() as RootState;
      expect(getIsPopupOpen(state)).toBe(false);

      store.dispatch(openPopup());
      state = store.getState() as RootState;
      expect(getIsPopupOpen(state)).toBe(true);

      store.dispatch(closePopup());
      state = store.getState() as RootState;
      expect(getIsPopupOpen(state)).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('должен обработать быстрые последовательные вызовы open', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      store.dispatch(openPopup());
      store.dispatch(openPopup());
      store.dispatch(openPopup());

      expect(store.getState().popup.isOpen).toBe(true);
    });

    test('должен обработать быстрые последовательные вызовы close', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
        preloadedState: {
          popup: {
            isOpen: true,
          },
        },
      });

      store.dispatch(closePopup());
      store.dispatch(closePopup());
      store.dispatch(closePopup());

      expect(store.getState().popup.isOpen).toBe(false);
    });

    test('должен обработать множественные переключения', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      // Начальное состояние: false
      expect(store.getState().popup.isOpen).toBe(false);

      // toggle -> true
      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(true);

      // toggle -> false
      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(false);

      // toggle -> true
      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(true);

      // close -> false
      store.dispatch(closePopup());
      expect(store.getState().popup.isOpen).toBe(false);

      // open -> true
      store.dispatch(openPopup());
      expect(store.getState().popup.isOpen).toBe(true);

      // toggle -> false
      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(false);
    });

    test('должен обработать неизвестное действие', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      const initialState = store.getState();

      store.dispatch({ type: 'unknown/action' } as any);

      const state = store.getState();
      expect(state.popup.isOpen).toBe(initialState.popup.isOpen);
    });

    test('должен обработать комбинацию open и toggle', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
      });

      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(openPopup());
      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(closePopup());
      expect(store.getState().popup.isOpen).toBe(false);
    });

    test('должен обработать комбинацию close и toggle', () => {
      const store = configureStore({
        reducer: {
          popup: popupReducer,
        },
        preloadedState: {
          popup: {
            isOpen: true,
          },
        },
      });

      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(closePopup());
      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(true);

      store.dispatch(togglePopup());
      expect(store.getState().popup.isOpen).toBe(false);

      store.dispatch(openPopup());
      expect(store.getState().popup.isOpen).toBe(true);
    });
  });
});
