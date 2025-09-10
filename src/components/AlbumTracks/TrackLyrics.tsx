// src/TrackLyrics.tsx

import React from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../../hooks/data';
import { useLang } from '../../hooks/useLang';

export default function TrackLyrics() {
  const { lang } = useLang();
  const { templateData } = useData(lang);

  // достаём параметры из URL
  const { albumId, trackId } = useParams<{ albumId: string; trackId: string }>();

  // ищем альбом
  const album = templateData.templateA.find((a) => a.albumId === albumId);

  // ищем трек внутри альбома
  const track = album?.tracks.find((t) => String(t.id) === trackId);

  return (
    <>
      <pre>
        <h2 className="track-lyrics">{track?.title}</h2>
      </pre>
      <pre>{track?.content}</pre>
    </>
  );
}
