// Редактор текстов внутри личного кабинета
import React from 'react';
import DashboardText from '@pages/DashboardText/DashboardText';
import './dashboardModalWrappers.style.scss';

interface DashboardTextEditorProps {
  userId?: string;
  albumId: string;
  trackId: string;
}

export function DashboardTextEditor({ userId, albumId, trackId }: DashboardTextEditorProps) {
  return (
    <div className="dashboard-text-editor">
      <DashboardText albumId={albumId} trackId={trackId} />
    </div>
  );
}
