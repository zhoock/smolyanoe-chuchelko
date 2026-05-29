import clsx from 'clsx';
import type { AlbumLifecycleStatus } from '@entities/album/lib/albumLifecycleStatus';
import type { IInterface } from '@models';

type AlbumLifecycleBadgeProps = {
  status: AlbumLifecycleStatus;
  ui?: IInterface;
  lang: string;
};

function statusLabel(
  status: AlbumLifecycleStatus,
  ui: IInterface | undefined,
  lang: string
): string {
  const en = lang !== 'ru';
  const d = ui?.dashboard;

  switch (status) {
    case 'ready-to-publish':
      return d?.albumStatusReadyToPublish ?? (en ? 'Ready to Publish' : 'Готов к публикации');
    case 'published':
      return d?.albumStatusPublished ?? (en ? 'Published' : 'Опубликован');
    default:
      return d?.albumStatusDraft ?? (en ? 'Draft' : 'Черновик');
  }
}

export function AlbumLifecycleBadge({ status, ui, lang }: AlbumLifecycleBadgeProps) {
  return (
    <span
      className={clsx('user-dashboard__album-status-badge', {
        'user-dashboard__album-status-badge--draft': status === 'draft',
        'user-dashboard__album-status-badge--ready': status === 'ready-to-publish',
        'user-dashboard__album-status-badge--published': status === 'published',
      })}
    >
      <span className="user-dashboard__album-status-badge-dot" aria-hidden="true" />
      {statusLabel(status, ui, lang)}
    </span>
  );
}
