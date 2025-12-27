// src/pages/UserDashboard/components/blocks/BlockDivider.tsx
import React from 'react';

interface BlockDividerProps {
  onFocus?: () => void;
  onBlur?: () => void;
}

export function BlockDivider({ onFocus, onBlur }: BlockDividerProps) {
  return (
    <div
      className="edit-article-v2__block edit-article-v2__block--divider"
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    >
      <hr />
    </div>
  );
}

