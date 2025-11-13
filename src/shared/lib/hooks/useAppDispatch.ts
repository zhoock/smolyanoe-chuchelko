import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@shared/model/appStore/types';

export const useAppDispatch = () => useDispatch<AppDispatch>();
