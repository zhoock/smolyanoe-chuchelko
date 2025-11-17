// Обёртка для компонента AdminSync, адаптированная для использования в дашборде
import React from 'react';
import AdminSync from '@pages/AdminSync/AdminSync';
import './AdminSyncWrapper.style.scss';

interface AdminSyncWrapperProps {
  userId?: string;
  albumId: string;
  trackId: string;
}

export function AdminSyncWrapper({ userId, albumId, trackId }: AdminSyncWrapperProps) {
  return (
    <div className="admin-sync-wrapper">
      <AdminSync albumId={albumId} trackId={trackId} />
    </div>
  );
}
