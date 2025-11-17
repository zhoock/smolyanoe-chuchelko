// Редактор выбранного альбома внутри личного кабинета
import React from 'react';
import DashboardAlbum from '@pages/DashboardAlbum/DashboardAlbum';
import './dashboardModalWrappers.style.scss';

interface DashboardAlbumEditorProps {
  userId?: string;
  albumId: string;
  onTrackSelect?: (albumId: string, trackId: string, type: 'sync' | 'text') => void;
}

export function DashboardAlbumEditor({
  userId,
  albumId,
  onTrackSelect,
}: DashboardAlbumEditorProps) {
  return (
    <div className="dashboard-album-editor">
      <DashboardAlbum albumId={albumId} onTrackSelect={onTrackSelect} />
    </div>
  );
}
