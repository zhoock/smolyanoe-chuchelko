// src/pages/UserDashboard/UserDashboardV2Simple.tsx
/**
 * Простая статическая верстка нового дизайна dashboard
 * БЕЗ логики - только верстка по макету в стиле ChatGPT popup
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { logout } from '@shared/lib/auth';
import './UserDashboardV2Simple.style.scss';

function UserDashboardV2Simple() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'albums' | 'posts'>('albums');

  return (
    <>
      <Helmet>
        <title>
          {lang === 'en' ? 'User Dashboard' : 'Кабинет пользователя'} — Смоляное Чучелко
        </title>
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
                  Albums
                </button>
                <button
                  type="button"
                  className={`dashboard-v2-simple__tab ${activeTab === 'posts' ? 'dashboard-v2-simple__tab--active' : ''}`}
                  onClick={() => setActiveTab('posts')}
                >
                  Posts
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
                {lang === 'en' ? 'Logout' : 'Выйти'}
              </button>
            </div>

            {/* Main layout */}
            <div className="dashboard-v2-simple__layout">
              {/* Left column - Profile */}
              <div className="dashboard-v2-simple__profile">
                <h3 className="dashboard-v2-simple__profile-title">Profile</h3>

                <div className="dashboard-v2-simple__avatar">
                  <div className="dashboard-v2-simple__avatar-img">
                    <img src="https://via.placeholder.com/128" alt="Profile" />
                  </div>
                </div>

                <div className="dashboard-v2-simple__profile-fields">
                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="name">Name</label>
                    <input id="name" type="text" defaultValue="John Doe" disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="username">Username</label>
                    <input id="username" type="text" defaultValue="johndoe" disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" defaultValue="johndoe@example.com" disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="location">Location</label>
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
                    <h3 className="dashboard-v2-simple__section-title">Albums</h3>
                    <div className="dashboard-v2-simple__section">
                      <div className="dashboard-v2-simple__albums-list">
                        <div className="dashboard-v2-simple__album-item">
                          <div className="dashboard-v2-simple__album-thumbnail">
                            <img
                              src="https://via.placeholder.com/80x80/ff6b6b/ffffff?text=FL"
                              alt="First Light"
                            />
                          </div>
                          <div className="dashboard-v2-simple__album-info">
                            <div className="dashboard-v2-simple__album-title">First Light</div>
                            <div className="dashboard-v2-simple__album-year">2023</div>
                          </div>
                          <div className="dashboard-v2-simple__album-arrow">›</div>
                        </div>

                        <div className="dashboard-v2-simple__album-divider"></div>

                        <div className="dashboard-v2-simple__album-item">
                          <div className="dashboard-v2-simple__album-thumbnail">
                            <img
                              src="https://via.placeholder.com/80x80/4ecdc4/ffffff?text=R"
                              alt="Reflections"
                            />
                          </div>
                          <div className="dashboard-v2-simple__album-info">
                            <div className="dashboard-v2-simple__album-title">Reflections</div>
                            <div className="dashboard-v2-simple__album-year">2023</div>
                          </div>
                          <div className="dashboard-v2-simple__album-arrow">›</div>
                        </div>

                        <div className="dashboard-v2-simple__album-divider"></div>

                        <div className="dashboard-v2-simple__album-item">
                          <div className="dashboard-v2-simple__album-thumbnail">
                            <img
                              src="https://via.placeholder.com/80x80/45b7d1/ffffff?text=W"
                              alt="Waves"
                            />
                          </div>
                          <div className="dashboard-v2-simple__album-info">
                            <div className="dashboard-v2-simple__album-title">Waves</div>
                            <div className="dashboard-v2-simple__album-year">2022</div>
                          </div>
                          <div className="dashboard-v2-simple__album-arrow">›</div>
                        </div>
                      </div>

                      <button type="button" className="dashboard-v2-simple__upload-button">
                        <span>+</span>
                        <span>Upload New Album</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="dashboard-v2-simple__section-title">Posts</h3>
                    <div className="dashboard-v2-simple__section">
                      <div className="dashboard-v2-simple__posts-prompt">
                        <div className="dashboard-v2-simple__posts-prompt-text">
                          Write and publish articles
                        </div>
                        <button type="button" className="dashboard-v2-simple__new-post-button">
                          New Post
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
    </>
  );
}

export default UserDashboardV2Simple;
