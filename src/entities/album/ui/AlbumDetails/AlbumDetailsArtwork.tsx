import type { IAlbums } from '@models';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ album }: { album: IAlbums }) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // UI словарь загружается через loader

  const { photographer, photographerURL, designer, designerURL } = album?.release || {};
  const titles = ui?.titles ?? {};

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
}
