// Редактор синхронизации текста и аудио внутри личного кабинета
import React from 'react';
import DashboardSync from '@pages/DashboardSync/DashboardSync';
import './dashboardModalWrappers.style.scss';

interface DashboardSyncEditorProps {
  userId?: string;
  albumId: string;
  trackId: string;
}

export function DashboardSyncEditor({ userId, albumId, trackId }: DashboardSyncEditorProps) {
  return (
    <div className="dashboard-sync-editor">
      <DashboardSync albumId={albumId} trackId={trackId} />
    </div>
  );
}
