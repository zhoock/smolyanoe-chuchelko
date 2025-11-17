// Обёртка для компонента AdminText, адаптированная для использования в дашборде
import React from 'react';
import AdminText from '@pages/AdminText/AdminText';
import './AdminTextWrapper.style.scss';

interface AdminTextWrapperProps {
  userId?: string;
  albumId: string;
  trackId: string;
}

export function AdminTextWrapper({ userId, albumId, trackId }: AdminTextWrapperProps) {
  return (
    <div className="admin-text-wrapper">
      <AdminText albumId={albumId} trackId={trackId} />
    </div>
  );
}
