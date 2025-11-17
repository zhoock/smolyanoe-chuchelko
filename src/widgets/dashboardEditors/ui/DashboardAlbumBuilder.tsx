// Создание нового альбома внутри личного кабинета
import React from 'react';
import { CreateAlbum } from '@features/createAlbum';
import '../styles/dashboardModalWrappers.style.scss';

interface DashboardAlbumBuilderProps {
  userId?: string;
  onBack?: () => void;
}

export function DashboardAlbumBuilder({ userId, onBack }: DashboardAlbumBuilderProps) {
  return (
    <div className="dashboard-album-builder">
      <CreateAlbum onBack={onBack} />
    </div>
  );
}
