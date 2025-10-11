// src/components/AlbumTracks/TracksLyrics.tsx
import { useParams } from 'react-router-dom';
import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { useLang } from '../../contexts/lang';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';

export const TracksLyrics = () => {
  const { lang } = useLang();
  const data = useAlbumsData(lang);

  const { albumId = '', trackId = '' } = useParams<{ albumId: string; trackId: string }>();

  if (!data) {
    return (
      <>
        <pre>
          <h2 className="track-lyrics">…</h2>
        </pre>
        <pre>…</pre>
      </>
    );
  }

  return (
    <DataAwait
      value={data.templateA}
      fallback={
        <>
          <pre>
            <h2 className="track-lyrics">
              <Loader />
            </h2>
          </pre>
          <pre>…</pre>
        </>
      }
      error={<ErrorMessage error="Не удалось загрузить текст трека" />}
    >
      {(albums) => {
        const album = albums.find((a) => a.albumId === albumId);
        const track = album?.tracks.find((t) => String(t.id) === trackId);

        if (!album || !track) {
          return <ErrorMessage error="Трек не найден" />;
        }

        return (
          <>
            <pre>
              <h2 className="track-lyrics">{track.title}</h2>
            </pre>
            <pre>{track.content}</pre>
          </>
        );
      }}
    </DataAwait>
  );
};
