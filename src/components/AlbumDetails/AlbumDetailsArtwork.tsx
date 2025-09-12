// src/components/AlbumDetails/AlbumDetailsArtwork.tsx

import React from 'react';
import type { IAlbums } from '../../models';
import { useAlbumsData } from '../../hooks/data';
import { useLang } from '../../contexts/lang';
import { DataAwait } from '../../shared/DataAwait';

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ album }: { album: IAlbums }) {
  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из лоадера

  if (!data) return null;

  const { photographer, photographerURL, designer, designerURL } = album?.release || {};

  return (
    <DataAwait value={data.templateC} fallback={null} error={null}>
      {(ui) => {
        const titles = ui?.[0]?.titles ?? {};
        return (
          <>
            {photographer && (
              <>
                <h3>{titles.photo ?? 'Фото'}</h3>
                <div className="album-details__artwork-photographer">
                  {photographerURL ? (
                    <a
                      className="album-details__link"
                      href={photographerURL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {photographer}
                    </a>
                  ) : (
                    photographer
                  )}
                </div>
              </>
            )}

            <h3>{titles.design ?? 'Дизайн'}</h3>
            <div className="album-details__artwork-designer">
              {designerURL ? (
                <a
                  className="album-details__link"
                  href={designerURL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {designer}
                </a>
              ) : (
                designer
              )}
            </div>
          </>
        );
      }}
    </DataAwait>
  );
}
