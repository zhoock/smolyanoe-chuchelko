import { SubscriberContentLockIcon } from '@shared/ui/icons/SubscriberContentLockIcon';
import './EmailVerificationLockedNotice.scss';

interface EmailVerificationLockedNoticeProps {
  title: string;
  hint: string;
}

export function EmailVerificationLockedNotice({ title, hint }: EmailVerificationLockedNoticeProps) {
  return (
    <div className="user-dashboard__email-verify-lock" role="status">
      <SubscriberContentLockIcon className="user-dashboard__email-verify-lock-icon" size={20} />
      <h3 className="user-dashboard__email-verify-lock-title">{title}</h3>
      <p className="user-dashboard__email-verify-lock-hint">{hint}</p>
    </div>
  );
}
