// Обёртка для компонента AdminAlbum, адаптированная для использования в дашборде
import React from 'react';
import AdminAlbum from '@pages/AdminAlbum/AdminAlbum';
import './AdminAlbumWrapper.style.scss';

interface AdminAlbumWrapperProps {
  userId?: string;
  albumId: string; // ID альбома передаётся через props
  onTrackSelect?: (albumId: string, trackId: string, type: 'sync' | 'text') => void; // Callback для выбора трека
}

export function AdminAlbumWrapper({ userId, albumId, onTrackSelect }: AdminAlbumWrapperProps) {
  return (
    <div className="admin-album-wrapper">
      <AdminAlbum albumId={albumId} onTrackSelect={onTrackSelect} />
    </div>
  );
}
