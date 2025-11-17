// Редактор синхронизации текста и аудио внутри личного кабинета
import React from 'react';
import { EditSyncLyrics } from '@features/editSyncLyrics';
import '../styles/dashboardModalWrappers.style.scss';

interface DashboardSyncEditorProps {
  userId?: string;
  albumId: string;
  trackId: string;
}

export function DashboardSyncEditor({ userId, albumId, trackId }: DashboardSyncEditorProps) {
  return (
    <div className="dashboard-sync-editor">
      <EditSyncLyrics albumId={albumId} trackId={trackId} />
    </div>
  );
}
