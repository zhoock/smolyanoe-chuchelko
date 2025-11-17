// Редактор текстов внутри личного кабинета
import React from 'react';
import { EditTrackText } from '@features/editTrackText';
import '../styles/dashboardModalWrappers.style.scss';

interface DashboardTextEditorProps {
  userId?: string;
  albumId: string;
  trackId: string;
}

export function DashboardTextEditor({ userId, albumId, trackId }: DashboardTextEditorProps) {
  return (
    <div className="dashboard-text-editor">
      <EditTrackText albumId={albumId} trackId={trackId} />
    </div>
  );
}
