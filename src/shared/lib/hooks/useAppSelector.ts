import { TypedUseSelectorHook, useSelector } from 'react-redux';
import type { RootState } from '@shared/model/appStore/types';

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
