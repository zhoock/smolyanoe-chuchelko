// src/pages/UserDashboard/components/PostsSection.tsx
/**
 * Компонент секции постов/статей в новом дизайне dashboard
 */
import { useLang } from '@app/providers/lang';
import './PostsSection.style.scss';

interface PostsSectionProps {
  userId?: string;
}

export function PostsSection({ userId }: PostsSectionProps) {
  const { lang } = useLang();

  const handleNewPost = () => {
    // TODO: Реализовать создание нового поста
    alert('New post creation will be implemented soon');
  };

  return (
    <div className="posts-section">
      <div className="posts-section__header">
        <h2 className="posts-section__title">Posts</h2>
      </div>

      <div className="posts-section__prompt">
        <div className="posts-section__prompt-text">Write and publish articles</div>
        <button type="button" className="posts-section__new-button" onClick={handleNewPost}>
          New Post
        </button>
      </div>

      <div className="posts-section__content">
        <h3 className="posts-section__subtitle">Posts</h3>
        {/* TODO: Здесь будет список постов */}
        <div className="posts-section__empty">
          <p>No posts yet. Create your first post!</p>
        </div>
      </div>
    </div>
  );
}
