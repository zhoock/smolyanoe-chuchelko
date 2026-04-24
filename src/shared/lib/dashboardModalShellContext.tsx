import { createContext, useContext } from 'react';
import type { Location } from 'react-router-dom';

export type DashboardModalShellValue = {
  /** Дашборд открыт поверх другой страницы (`Routes` снизу остаются на surface). */
  overlayOpen: boolean;
  surfaceLocation: Location | null;
};

const defaultValue: DashboardModalShellValue = {
  overlayOpen: false,
  surfaceLocation: null,
};

export const DashboardModalShellContext = createContext<DashboardModalShellValue>(defaultValue);

export function useDashboardModalShell() {
  return useContext(DashboardModalShellContext);
}
