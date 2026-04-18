import React from 'react';
import '@shared/ui/skeleton/skeleton.scss';

/** Стабильная высота контента при первой загрузке альбомов (без смены разметки карточки). */
export function DashboardTabContentSkeleton() {
  return (
    <div className="user-dashboard__tab-skeleton" aria-busy="true" aria-live="polite">
      <div className="skeleton skeleton--bar skeleton--bar-title user-dashboard__tab-skeleton-title" />
      <div className="user-dashboard__albums-list">
        {Array.from({ length: 5 }).map((_, index) => (
          <React.Fragment key={index}>
            <div className="user-dashboard__album-item">
              <div className="user-dashboard__album-thumbnail">
                <div className="skeleton skeleton--image" />
              </div>
              <div className="user-dashboard__album-info">
                <div className="skeleton skeleton--bar skeleton--bar-title" />
                <div className="skeleton skeleton--bar skeleton--bar-medium" />
              </div>
              <div className="user-dashboard__album-arrow">
                <div className="skeleton skeleton--arrow" />
              </div>
            </div>
            {index < 4 && <div className="user-dashboard__album-divider" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
