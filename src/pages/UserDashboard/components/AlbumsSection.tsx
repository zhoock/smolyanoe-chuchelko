// src/pages/UserDashboard/components/AlbumsSection.tsx
/**
 * Компонент секции альбомов в новом дизайне dashboard
 */
import { memo } from 'react';
import { DashboardAlbumsRoot } from '@widgets/dashboardAlbums';
import './AlbumsSection.style.scss';

interface AlbumsSectionProps {
  userId?: string;
  onAlbumSelect?: (albumId: string) => void;
  onBuilderOpen?: () => void;
}

export const AlbumsSection = memo(function AlbumsSection({
  userId,
  onAlbumSelect,
  onBuilderOpen,
}: AlbumsSectionProps) {
  return (
    <div className="albums-section">
      <div className="albums-section__header">
        <h2 className="albums-section__title">Albums</h2>
        <button
          type="button"
          className="albums-section__upload-button"
          onClick={onBuilderOpen}
          aria-label="Upload New Album"
        >
          <span className="albums-section__upload-icon">+</span>
          <span className="albums-section__upload-text">Upload New Album</span>
        </button>
      </div>

      <div className="albums-section__content">
        <div className="albums-section__widget-wrapper">
          <DashboardAlbumsRoot
            userId={userId}
            onAlbumSelect={onAlbumSelect}
            onBuilderOpen={onBuilderOpen}
          />
        </div>
      </div>
    </div>
  );
});
