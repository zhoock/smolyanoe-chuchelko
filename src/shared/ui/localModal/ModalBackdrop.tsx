import clsx from 'clsx';

import './localModal.scss';

type ModalBackdropProps = {
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

/** Div overlay for route-based modals (Auth, Reset Password). */
export function ModalBackdrop({ className, onClick }: ModalBackdropProps) {
  return <div className={clsx('modal-backdrop', className)} onClick={onClick} aria-hidden="true" />;
}
