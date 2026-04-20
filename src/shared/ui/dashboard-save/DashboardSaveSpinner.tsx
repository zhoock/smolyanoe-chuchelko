import './dashboard-save.scss';

type DashboardSaveSpinnerProps = {
  className?: string;
};

/** Кольцевой спиннер для основной кнопки сохранения (currentColor). */
export function DashboardSaveSpinner({ className }: DashboardSaveSpinnerProps) {
  return (
    <span className={['dashboard-save-spinner', className].filter(Boolean).join(' ')} aria-hidden />
  );
}
