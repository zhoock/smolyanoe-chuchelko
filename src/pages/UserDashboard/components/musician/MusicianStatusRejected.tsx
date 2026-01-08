/**
 * Компонент для отображения статуса "Заявка отклонена"
 */

import React, { useState } from 'react';
import { MusicianOnboarding } from './MusicianOnboarding';
import './MusicianStatusRejected.style.scss';

interface MusicianStatusRejectedProps {
  rejectReason?: string;
  onReapply: () => void;
}

export function MusicianStatusRejected({ rejectReason, onReapply }: MusicianStatusRejectedProps) {
  const [showReapplyForm, setShowReapplyForm] = useState(false);

  if (showReapplyForm) {
    return (
      <div className="musician-status-rejected">
        <MusicianOnboarding onSuccess={onReapply} onCancel={() => setShowReapplyForm(false)} />
      </div>
    );
  }

  return (
    <div className="musician-status-rejected">
      <div className="musician-status-rejected__icon">❌</div>
      <h2 className="musician-status-rejected__title">Заявка отклонена</h2>
      {rejectReason && (
        <div className="musician-status-rejected__reason">
          <strong>Причина:</strong>
          <p>{rejectReason}</p>
        </div>
      )}
      <p className="musician-status-rejected__description">
        Вы можете подать заявку снова, исправив указанные замечания.
      </p>
      <button onClick={() => setShowReapplyForm(true)} className="musician-status-rejected__button">
        Подать заявку снова
      </button>
    </div>
  );
}
