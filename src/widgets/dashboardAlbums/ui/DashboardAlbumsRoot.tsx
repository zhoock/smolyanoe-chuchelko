// Обёртка для раздела альбомов в личном кабинете
import React from 'react';
import { ErrorMessage } from '@shared/ui/error-message';
import { ErrorBoundary } from '@shared/ui/error-boundary';
import DashboardAlbumsOverview from './DashboardAlbumsOverview';
import './DashboardAlbumsRoot.style.scss';

interface DashboardAlbumsRootProps {
  userId?: string;
  onAlbumSelect?: (albumId: string) => void;
  onBuilderOpen?: () => void;
}

export function DashboardAlbumsRoot({
  userId,
  onAlbumSelect,
  onBuilderOpen,
}: DashboardAlbumsRootProps) {
  return (
    <div className="dashboard-albums-root">
      <ErrorBoundary
        fallback={
          <div style={{ padding: '24px' }}>
            <ErrorMessage error="Ошибка загрузки раздела альбомов" />
          </div>
        }
      >
        <DashboardAlbumsOverview onAlbumSelect={onAlbumSelect} onBuilderOpen={onBuilderOpen} />
      </ErrorBoundary>
    </div>
  );
}
