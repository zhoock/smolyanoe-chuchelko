import React from 'react';
import '@shared/ui/skeleton/skeleton.scss';
import './articles/ArticlesListSkeleton.scss';

/**
 * Скелетон вкладки Profile — hero + поля + действия.
 */
export function ProfileTabSkeleton() {
  return (
    <div
      className="user-dashboard__tab-skeleton user-dashboard__profile-tab-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="skeleton skeleton--bar skeleton--bar-title user-dashboard__tab-skeleton-title" />
      <div className="user-dashboard__profile-skeleton-inner">
        <div className="user-dashboard__profile-skeleton-hero">
          <div className="user-dashboard__profile-skeleton-avatar-wrap">
            <div className="skeleton skeleton--image user-dashboard__profile-skeleton-avatar-circle" />
          </div>
          <div className="skeleton skeleton--bar skeleton--bar-medium user-dashboard__profile-skeleton-name" />
          <div className="skeleton skeleton--bar skeleton--bar-short user-dashboard__profile-skeleton-status" />
          <div className="skeleton skeleton--bar user-dashboard__profile-skeleton-description" />
          <div className="skeleton skeleton--bar skeleton--bar-medium user-dashboard__profile-skeleton-open" />
        </div>

        {[0, 1].map((i) => (
          <div key={i} className="user-dashboard__profile-skeleton-field">
            <div className="skeleton skeleton--bar skeleton--bar-short" />
            <div className="skeleton skeleton--bar skeleton--bar-medium user-dashboard__profile-skeleton-input" />
          </div>
        ))}

        <div className="user-dashboard__profile-skeleton-actions">
          <div className="skeleton skeleton--bar skeleton--bar-medium user-dashboard__profile-skeleton-btn" />
          <div className="skeleton skeleton--bar skeleton--bar-medium user-dashboard__profile-skeleton-btn" />
        </div>
      </div>
    </div>
  );
}
