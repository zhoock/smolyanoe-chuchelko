// src/pages/UserDashboard/UserDashboardV2Simple.tsx
/**
 * Простая статическая верстка нового дизайна dashboard
 * БЕЗ логики - только верстка по макету в стиле ChatGPT popup
 */
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { getUserImageUrl } from '@shared/api/albums';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { logout } from '@shared/lib/auth';
import { AddLyricsModal } from './components/AddLyricsModal';
import { EditLyricsModal } from './components/EditLyricsModal';
import { PreviewLyricsModal } from './components/PreviewLyricsModal';
import { EditAlbumModal } from './components/EditAlbumModal';
import { SyncLyricsModal } from './components/SyncLyricsModal';
import './UserDashboardV2Simple.style.scss';

interface AlbumData {
  id: string;
  title: string;
  year: string;
  cover: string;
  releaseDate?: string;
  tracks: TrackData[];
}

interface TrackData {
  id: string;
  title: string;
  duration: string;
  lyricsStatus: 'synced' | 'text-only' | 'empty';
  lyricsText?: string;
  src?: string;
}

// Mock текст для редактирования
const MOCK_LYRICS_TEXT =
  "Venturing beyond the familiar\nThrough the void of space I soar\nCarried by stars' glow so peculiar\nFinding what I've never seen before";

const initialAlbumsData: AlbumData[] = [
  {
    id: '23-remastered',
    title: '23',
    year: '2023',
    cover: 'Tar-Baby-Cover-23-remastered',
    releaseDate: 'April 5, 2024',
    tracks: [
      {
        id: '1',
        title: 'Into the Unknown',
        duration: '3:45',
        lyricsStatus: 'synced',
        lyricsText: MOCK_LYRICS_TEXT,
      },
      {
        id: '2',
        title: "Journey's End",
        duration: '4:20',
        lyricsStatus: 'text-only',
        lyricsText: MOCK_LYRICS_TEXT,
      },
      {
        id: '3',
        title: 'Beyond the Stars',
        duration: '5:10',
        lyricsStatus: 'empty',
      },
    ],
  },
  {
    id: '23',
    title: '23',
    year: '2023',
    cover: 'Tar-Baby-Cover-23',
    tracks: [
      {
        id: '1',
        title: 'Track 1',
        duration: '3:00',
        lyricsStatus: 'empty',
      },
    ],
  },
  {
    id: 'tar-baby',
    title: 'Смоляное Чучелко',
    year: '2022',
    cover: 'Tar-Baby-Cover',
    tracks: [
      {
        id: '1',
        title: 'Track 1',
        duration: '3:00',
        lyricsStatus: 'empty',
      },
    ],
  },
];

function UserDashboardV2Simple() {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'albums' | 'posts'>('albums');
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [albumsData, setAlbumsData] = useState<AlbumData[]>(initialAlbumsData);
  const fileInputRefs = useRef<{ [albumId: string]: HTMLInputElement | null }>({});
  const [addLyricsModal, setAddLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
  } | null>(null);
  const [editLyricsModal, setEditLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
    trackStatus: TrackData['lyricsStatus'];
  } | null>(null);
  const [previewLyricsModal, setPreviewLyricsModal] = useState<{
    isOpen: boolean;
    lyrics: string;
  } | null>(null);
  const [syncLyricsModal, setSyncLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
    trackSrc?: string;
    lyricsText?: string;
  } | null>(null);
  const [editAlbumModal, setEditAlbumModal] = useState<{
    isOpen: boolean;
    albumId: string;
  } | null>(null);

  const toggleAlbum = (albumId: string) => {
    setExpandedAlbumId((prev) => (prev === albumId ? null : albumId));
  };

  const getLyricsStatusText = (status: TrackData['lyricsStatus']) => {
    switch (status) {
      case 'synced':
        return ui?.dashboard?.addedSynced ?? 'Added, synced';
      case 'text-only':
        return ui?.dashboard?.addedNoSync ?? 'Added, no sync';
      case 'empty':
        return ui?.dashboard?.noLyrics ?? 'No lyrics';
      default:
        return '';
    }
  };

  const getLyricsActions = (status: TrackData['lyricsStatus']) => {
    switch (status) {
      case 'synced':
        return [
          { label: ui?.dashboard?.edit ?? 'Edit', action: 'edit' },
          { label: ui?.dashboard?.prev ?? 'Prev', action: 'prev' },
        ];
      case 'text-only':
        return [
          { label: ui?.dashboard?.edit ?? 'Edit', action: 'edit' },
          { label: ui?.dashboard?.sync ?? 'Sync', action: 'sync' },
        ];
      case 'empty':
        return [{ label: ui?.dashboard?.add ?? 'Add', action: 'add' }];
      default:
        return [];
    }
  };

  const handleLyricsAction = (
    action: string,
    albumId: string,
    trackId: string,
    trackTitle: string
  ) => {
    if (action === 'add') {
      setAddLyricsModal({ isOpen: true, albumId, trackId, trackTitle });
    } else if (action === 'edit') {
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      if (track) {
        setEditLyricsModal({
          isOpen: true,
          albumId,
          trackId,
          trackTitle,
          trackStatus: track.lyricsStatus,
        });
      }
    } else if (action === 'prev') {
      const lyrics = getTrackLyricsText(albumId, trackId);
      setPreviewLyricsModal({ isOpen: true, lyrics });
    } else if (action === 'sync') {
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      if (track) {
        const lyricsText = getTrackLyricsText(albumId, trackId);
        setSyncLyricsModal({
          isOpen: true,
          albumId,
          trackId,
          trackTitle,
          trackSrc: track.src,
          lyricsText,
        });
      }
    }
  };

  const handleAddLyrics = () => {
    if (!addLyricsModal) return;

    setAlbumsData((prev) =>
      prev.map((album) => {
        if (album.id === addLyricsModal.albumId) {
          return {
            ...album,
            tracks: album.tracks.map((track) =>
              track.id === addLyricsModal.trackId
                ? { ...track, lyricsStatus: 'text-only' as const }
                : track
            ),
          };
        }
        return album;
      })
    );
    setAddLyricsModal(null);
  };

  const handleSaveLyrics = (lyrics: string) => {
    if (!editLyricsModal) return;

    setAlbumsData((prev) =>
      prev.map((album) => {
        if (album.id === editLyricsModal.albumId) {
          return {
            ...album,
            tracks: album.tracks.map((track) =>
              track.id === editLyricsModal.trackId ? { ...track, lyricsText: lyrics } : track
            ),
          };
        }
        return album;
      })
    );
  };

  const getTrackLyricsText = (albumId: string, trackId: string): string => {
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    return track?.lyricsText ?? MOCK_LYRICS_TEXT;
  };

  const handlePreviewLyrics = () => {
    if (!editLyricsModal) return;
    const lyrics = getTrackLyricsText(editLyricsModal.albumId, editLyricsModal.trackId);
    setPreviewLyricsModal({ isOpen: true, lyrics });
  };

  return (
    <>
      <Helmet>
        <title>{ui?.dashboard?.title ?? 'User Dashboard'} — Смоляное Чучелко</title>
      </Helmet>

      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="dashboard-v2-simple">
          {/* Main card container */}
          <div className="dashboard-v2-simple__card">
            {/* Header with tabs */}
            <div className="dashboard-v2-simple__header">
              <div className="dashboard-v2-simple__tabs">
                <button
                  type="button"
                  className={`dashboard-v2-simple__tab ${activeTab === 'albums' ? 'dashboard-v2-simple__tab--active' : ''}`}
                  onClick={() => setActiveTab('albums')}
                >
                  {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                </button>
                <button
                  type="button"
                  className={`dashboard-v2-simple__tab ${activeTab === 'posts' ? 'dashboard-v2-simple__tab--active' : ''}`}
                  onClick={() => setActiveTab('posts')}
                >
                  {ui?.dashboard?.tabs?.posts ?? 'Posts'}
                </button>
              </div>
              <button
                type="button"
                className="dashboard-v2-simple__logout-button"
                onClick={() => {
                  logout();
                  navigate('/auth');
                }}
              >
                {ui?.dashboard?.logout ?? 'Logout'}
              </button>
            </div>

            {/* Main layout */}
            <div className="dashboard-v2-simple__layout">
              {/* Left column - Profile */}
              <div className="dashboard-v2-simple__profile">
                <h3 className="dashboard-v2-simple__profile-title">
                  {ui?.dashboard?.profile ?? 'Profile'}
                </h3>

                <div className="dashboard-v2-simple__avatar">
                  <div className="dashboard-v2-simple__avatar-img">
                    <img
                      src={getUserImageUrl('yaroslav_zhoock', 'profile', '.jpg')}
                      alt={ui?.dashboard?.profile ?? 'Profile'}
                    />
                  </div>
                </div>

                <div className="dashboard-v2-simple__profile-fields">
                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="name">{ui?.dashboard?.profileFields?.name ?? 'Name'}</label>
                    <input id="name" type="text" defaultValue="John Doe" disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="username">
                      {ui?.dashboard?.profileFields?.username ?? 'Username'}
                    </label>
                    <input id="username" type="text" defaultValue="johndoe" disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="email">{ui?.dashboard?.profileFields?.email ?? 'Email'}</label>
                    <input id="email" type="email" defaultValue="johndoe@example.com" disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="location">
                      {ui?.dashboard?.profileFields?.location ?? 'Location'}
                    </label>
                    <input id="location" type="text" defaultValue="San Francisco, CA" disabled />
                  </div>
                </div>
              </div>

              {/* Vertical separator */}
              <div className="dashboard-v2-simple__separator"></div>

              {/* Right column - Content */}
              <div className="dashboard-v2-simple__content">
                {activeTab === 'albums' ? (
                  <>
                    <h3 className="dashboard-v2-simple__section-title">
                      {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                    </h3>
                    <div className="dashboard-v2-simple__section">
                      <div className="dashboard-v2-simple__albums-list">
                        {albumsData.map((album, index) => {
                          const isExpanded = expandedAlbumId === album.id;
                          return (
                            <React.Fragment key={album.id}>
                              <div
                                className={`dashboard-v2-simple__album-item ${isExpanded ? 'dashboard-v2-simple__album-item--expanded' : ''}`}
                                onClick={() => toggleAlbum(album.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleAlbum(album.id);
                                  }
                                }}
                                aria-label={isExpanded ? 'Collapse album' : 'Expand album'}
                              >
                                <div className="dashboard-v2-simple__album-thumbnail">
                                  <img
                                    src={getUserImageUrl(album.cover, 'albums', '@2x-128.webp')}
                                    alt={album.title}
                                  />
                                </div>
                                <div className="dashboard-v2-simple__album-info">
                                  <div className="dashboard-v2-simple__album-title">
                                    {album.title}
                                  </div>
                                  {album.releaseDate ? (
                                    <div className="dashboard-v2-simple__album-date">
                                      {album.releaseDate}
                                    </div>
                                  ) : (
                                    <div className="dashboard-v2-simple__album-year">
                                      {album.year}
                                    </div>
                                  )}
                                </div>
                                <div
                                  className={`dashboard-v2-simple__album-arrow ${isExpanded ? 'dashboard-v2-simple__album-arrow--expanded' : ''}`}
                                >
                                  {isExpanded ? '⌃' : '›'}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="dashboard-v2-simple__album-expanded">
                                  {/* Edit Album button */}
                                  <button
                                    type="button"
                                    className="dashboard-v2-simple__edit-album-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditAlbumModal({ isOpen: true, albumId: album.id });
                                    }}
                                  >
                                    {ui?.dashboard?.editAlbum ?? 'Edit Album'}
                                  </button>

                                  {/* Track upload section */}
                                  <div className="dashboard-v2-simple__track-upload">
                                    <div className="dashboard-v2-simple__track-upload-text">
                                      {ui?.dashboard?.dropTracksHere ?? 'Drop tracks here or'}
                                    </div>
                                    <input
                                      ref={(el) => {
                                        fileInputRefs.current[album.id] = el;
                                      }}
                                      type="file"
                                      multiple
                                      accept="audio/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const files = e.target.files;
                                        if (files && files.length > 0) {
                                          // TODO: Обработка загруженных файлов
                                          console.log('Selected files:', files);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="dashboard-v2-simple__choose-files-button"
                                      onClick={() => {
                                        const input = fileInputRefs.current[album.id];
                                        if (input) {
                                          input.click();
                                        }
                                      }}
                                    >
                                      {ui?.dashboard?.chooseFiles ?? 'Choose files'}
                                    </button>
                                  </div>

                                  {/* Tracks list */}
                                  <div className="dashboard-v2-simple__tracks-list">
                                    {album.tracks.map((track) => (
                                      <div
                                        key={track.id}
                                        className="dashboard-v2-simple__track-item"
                                      >
                                        <div className="dashboard-v2-simple__track-number">
                                          {track.id.padStart(2, '0')}
                                        </div>
                                        <div className="dashboard-v2-simple__track-title">
                                          {track.title}
                                        </div>
                                        <div className="dashboard-v2-simple__track-duration">
                                          {track.duration}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Lyrics section */}
                                  <div className="dashboard-v2-simple__lyrics-section">
                                    <h4 className="dashboard-v2-simple__lyrics-title">
                                      {ui?.dashboard?.lyrics ?? 'Lyrics'}
                                    </h4>
                                    <div className="dashboard-v2-simple__lyrics-table">
                                      <div className="dashboard-v2-simple__lyrics-header">
                                        <div className="dashboard-v2-simple__lyrics-header-cell">
                                          {ui?.dashboard?.track ?? 'Track'}
                                        </div>
                                        <div className="dashboard-v2-simple__lyrics-header-cell">
                                          {ui?.dashboard?.status ?? 'Status'}
                                        </div>
                                        <div className="dashboard-v2-simple__lyrics-header-cell">
                                          {ui?.dashboard?.actions ?? 'Actions'}
                                        </div>
                                      </div>
                                      {album.tracks.map((track) => (
                                        <div
                                          key={track.id}
                                          className="dashboard-v2-simple__lyrics-row"
                                        >
                                          <div className="dashboard-v2-simple__lyrics-cell">
                                            {track.title}
                                          </div>
                                          <div className="dashboard-v2-simple__lyrics-cell">
                                            {getLyricsStatusText(track.lyricsStatus)}
                                          </div>
                                          <div className="dashboard-v2-simple__lyrics-cell dashboard-v2-simple__lyrics-cell--actions">
                                            {getLyricsActions(track.lyricsStatus).map(
                                              (action, idx) => (
                                                <button
                                                  key={idx}
                                                  type="button"
                                                  className="dashboard-v2-simple__lyrics-action-button"
                                                  onClick={() =>
                                                    handleLyricsAction(
                                                      action.action,
                                                      album.id,
                                                      track.id,
                                                      track.title
                                                    )
                                                  }
                                                >
                                                  {action.label}
                                                </button>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {index < albumsData.length - 1 && (
                                <div className="dashboard-v2-simple__album-divider"></div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <button type="button" className="dashboard-v2-simple__upload-button">
                        <span>+</span>
                        <span>{ui?.dashboard?.uploadNewAlbum ?? 'Upload New Album'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="dashboard-v2-simple__section-title">
                      {ui?.dashboard?.tabs?.posts ?? 'Posts'}
                    </h3>
                    <div className="dashboard-v2-simple__section">
                      <div className="dashboard-v2-simple__posts-prompt">
                        <div className="dashboard-v2-simple__posts-prompt-text">
                          {ui?.dashboard?.writeAndPublishArticles ?? 'Write and publish articles'}
                        </div>
                        <button type="button" className="dashboard-v2-simple__new-post-button">
                          {ui?.dashboard?.newPost ?? 'New Post'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Hamburger isActive={true} onToggle={() => navigate('/')} />
      </Popup>

      {/* Add Lyrics Modal */}
      {addLyricsModal && (
        <AddLyricsModal
          isOpen={addLyricsModal.isOpen}
          trackTitle={addLyricsModal.trackTitle}
          onClose={() => setAddLyricsModal(null)}
          onSave={handleAddLyrics}
        />
      )}

      {/* Edit Lyrics Modal */}
      {editLyricsModal && (
        <EditLyricsModal
          isOpen={editLyricsModal.isOpen}
          initialLyrics={getTrackLyricsText(editLyricsModal.albumId, editLyricsModal.trackId)}
          onClose={() => setEditLyricsModal(null)}
          onSave={handleSaveLyrics}
          onPreview={editLyricsModal.trackStatus === 'synced' ? handlePreviewLyrics : undefined}
        />
      )}

      {/* Preview Lyrics Modal */}
      {previewLyricsModal && (
        <PreviewLyricsModal
          isOpen={previewLyricsModal.isOpen}
          lyrics={previewLyricsModal.lyrics}
          onClose={() => setPreviewLyricsModal(null)}
        />
      )}

      {/* Sync Lyrics Modal */}
      {syncLyricsModal && (
        <SyncLyricsModal
          isOpen={syncLyricsModal.isOpen}
          albumId={syncLyricsModal.albumId}
          trackId={syncLyricsModal.trackId}
          trackTitle={syncLyricsModal.trackTitle}
          trackSrc={syncLyricsModal.trackSrc}
          lyricsText={syncLyricsModal.lyricsText}
          onClose={() => setSyncLyricsModal(null)}
        />
      )}

      {/* Edit Album Modal */}
      {editAlbumModal && (
        <EditAlbumModal
          isOpen={editAlbumModal.isOpen}
          albumId={editAlbumModal.albumId}
          onClose={() => setEditAlbumModal(null)}
          onNext={(data) => {
            console.log('Album form data:', data);
            // TODO: Handle form submission
            setEditAlbumModal(null);
          }}
        />
      )}
    </>
  );
}

export default UserDashboardV2Simple;
