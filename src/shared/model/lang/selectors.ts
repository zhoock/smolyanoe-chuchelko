import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from './langSlice';

export const selectCurrentLang = (state: RootState): SupportedLang => state.lang.current;

