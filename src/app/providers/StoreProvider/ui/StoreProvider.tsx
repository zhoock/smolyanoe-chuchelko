import { ReactNode, useMemo } from 'react';
import { Provider } from 'react-redux';
import { createReduxStore } from '@shared/model/appStore';

interface StoreProviderProps {
  children: ReactNode;
}

export const StoreProvider = ({ children }: StoreProviderProps) => {
  const store = useMemo(() => createReduxStore(), []);

  return <Provider store={store}>{children}</Provider>;
};
