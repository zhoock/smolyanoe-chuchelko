// Создание нового альбома внутри личного кабинета
import React from 'react';
import DashboardAlbumBuilderPage from '@pages/DashboardAlbumBuilderPage/DashboardAlbumBuilderPage';
import './dashboardModalWrappers.style.scss';

interface DashboardAlbumBuilderProps {
  userId?: string;
  onBack?: () => void;
}

export function DashboardAlbumBuilder({ userId, onBack }: DashboardAlbumBuilderProps) {
  return (
    <div className="dashboard-album-builder">
      <DashboardAlbumBuilderPage onBack={onBack} />
    </div>
  );
}
