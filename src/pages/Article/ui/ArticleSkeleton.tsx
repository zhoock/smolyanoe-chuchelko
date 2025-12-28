import React from 'react';
import '@shared/ui/skeleton/skeleton.scss';
import './ArticleSkeleton.scss';

export function ArticleSkeleton() {
  return (
    <div className="article-skeleton">
      {/* Date skeleton */}
      <div className="article-skeleton__date">
        <div className="skeleton skeleton--bar skeleton--bar-short" />
      </div>

      {/* Title skeleton */}
      <div className="article-skeleton__title">
        <div className="skeleton skeleton--bar skeleton--bar-title" />
      </div>

      {/* Content skeleton */}
      <div className="article-skeleton__content">
        <div className="article-skeleton__top">
          <div className="skeleton skeleton--bar skeleton--bar-medium" />
          {/* <div className="skeleton skeleton--bar skeleton--bar-medium" /> */}
          {/* <div className="skeleton skeleton--bar skeleton--bar-short" /> */}
        </div>
        <div className="skeleton skeleton--content-area" />
      </div>
    </div>
  );
}
