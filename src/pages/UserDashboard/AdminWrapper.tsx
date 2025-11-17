// Обёртка для компонента Admin, адаптированная для использования в дашборде
import React from 'react';
import { ErrorMessage } from '@shared/ui/error-message';
import { ErrorBoundary } from '@shared/ui/error-boundary';
import Admin from '@pages/Admin/Admin';
import './AdminWrapper.style.scss';

interface AdminWrapperProps {
  userId?: string; // Принимаем, но не используем
  onAlbumSelect?: (albumId: string) => void; // Callback для выбора альбома
}

export function AdminWrapper({ userId, onAlbumSelect }: AdminWrapperProps) {
  // userId не используется, но принимается для совместимости с TabConfig
  return (
    <div className="admin-wrapper">
      <ErrorBoundary
        fallback={
          <div style={{ padding: '24px' }}>
            <ErrorMessage error="Ошибка загрузки компонента Admin" />
          </div>
        }
      >
        <Admin onAlbumSelect={onAlbumSelect} />
      </ErrorBoundary>
    </div>
  );
}
