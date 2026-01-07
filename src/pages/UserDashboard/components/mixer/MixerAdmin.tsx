// src/pages/UserDashboard/components/mixer/MixerAdmin.tsx
import React from 'react';
import type { IInterface } from '@models';

interface MixerAdminProps {
  ui?: IInterface;
}

export function MixerAdmin({ ui }: MixerAdminProps) {
  const t = ui?.dashboard?.mixer;

  const sections = [
    {
      title: t?.songsTitle ?? 'Песни',
      description:
        t?.songsDescription ??
        'Список песен для микшера. Добавьте или выберите песню, чтобы управлять её партиями.',
      placeholder: t?.songsPlaceholder ?? 'Список песен появится здесь.',
    },
    {
      title: t?.stemsTitle ?? 'Партии (stems)',
      description:
        t?.stemsDescription ??
        'Переключение и загрузка партий внутри выбранной песни: вокал, гитара, бас, барабаны и т.д.',
      placeholder: t?.stemsPlaceholder ?? 'Выберите песню, чтобы увидеть партии.',
    },
    {
      title: t?.contentTitle ?? 'Контент страницы (RU / EN)',
      description:
        t?.contentDescription ??
        'Описание страницы миксера и инфоблоки для RU/EN. Добавьте текст и дополнительную информацию.',
      placeholder: t?.contentPlaceholder ?? 'Добавьте описание и инфоблоки для RU и EN.',
    },
  ];

  return (
    <div className="mixer-admin">
      <h3 className="user-dashboard__section-title">{t?.title ?? 'Миксер'}</h3>
      <div className="mixer-admin__grid">
        {sections.map((section) => (
          <div key={section.title} className="mixer-admin__card">
            <div className="mixer-admin__card-header">
              <h4 className="mixer-admin__card-title">{section.title}</h4>
              <p className="mixer-admin__card-subtitle">{section.description}</p>
            </div>
            <div className="mixer-admin__card-body">
              <div className="mixer-admin__placeholder">{section.placeholder}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
