// src/pages/StemsPlayground/StemsPlayground.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Waveform } from '@shared/ui/waveform';
import { useLang } from '@app/providers/lang';
import { getUserImageUrl, getUserAudioUrl } from '@shared/api/albums';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { StemEngine, StemKind } from '@audio/stemsEngine';
import { Text } from '@shared/ui/text';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { fetchAlbums } from '@entities/album/model/albumsSlice';
import { selectAlbumsData, selectAlbumsStatus } from '@entities/album/model/selectors';
import { listStorageByPrefix, getStorageFileUrl } from '@shared/api/storage';
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '@config/supabase';
import { getUserUserId, CURRENT_USER_CONFIG } from '@config/user';
import './style.scss';

type Song = {
  id: string;
  title: string;
  mix?: string;
  stems: Partial<Record<StemKind, string>>; // Не все стемы обязательны
  portraits?: Partial<Record<StemKind, string>>;
};

// Маппинг ключей стемов из админки в ключи StemKind
const STEM_KEY_MAP: Record<string, StemKind> = {
  drums: 'drums',
  bass: 'bass',
  guitars: 'guitar', // В админке 'guitars', в StemKind 'guitar'
  vocals: 'vocal', // В админке 'vocals', в StemKind 'vocal'
};

// Функция для получения дефолтной обложки стема из папки Mixer
function getDefaultStemPortrait(stemKind: StemKind): string {
  // Маппинг StemKind на имена файлов в папке Mixer
  const fileNameMap: Record<StemKind, string> = {
    drums: 'drums',
    bass: 'bass',
    guitar: 'guitars', // В папке Mixer используем 'guitars' (как в админке)
    vocal: 'vocals', // В папке Mixer используем 'vocals' (как в админке)
  };
  const fileName = fileNameMap[stemKind];
  // Возвращаем URL из папки Mixer в категории stems
  return getUserImageUrl(`Mixer/${fileName}`, 'stems', '.png');
}

// Статические песни для обратной совместимости (используются как fallback)
const STATIC_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Последний поршневый бомбардировщик',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/01-The-last-piston-bomber-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/01_PPB_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/01_PPB_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/01_PPB_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/01_PPB_vocals.mp3'),
    },
  },
  {
    id: 'song-2',
    title: 'Водянистая влага',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/02-Watery-moisture-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/02_VV_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/02_VV_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/02_VV_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/02_VV_vocals.mp3'),
    },
  },
  {
    id: 'song-3',
    title: 'Рулевой мёртв',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/03-Helmsman-is-dead-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/03_RM_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/03_RM_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/03_RM_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/03_RM_vocals.mp3'),
    },
  },
  {
    id: 'song-4',
    title: 'Бром и сталь',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/04-Bromine-and-steel-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/04_BIS_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/04_BIS_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/04_BIS_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/04_BIS_vocals.mp3'),
    },
  },
  {
    id: 'song-5',
    title: 'Падение кита',
    mix: getUserAudioUrl('Smolyanoe-chuchelko/05-Whale-falling-1644.wav'),
    stems: {
      drums: getUserAudioUrl('EP_Mixer/05_PK_drums.mp3'),
      bass: getUserAudioUrl('EP_Mixer/05_PK_bass.mp3'),
      guitar: getUserAudioUrl('EP_Mixer/05_PK_guitars.mp3'),
      vocal: getUserAudioUrl('EP_Mixer/05_PK_vocals.mp3'),
    },
  },
  {
    id: 'song-6',
    title: 'Фиджийская русалка Барнума',
    mix: getUserAudioUrl('23/01-Barnums-Fijian-Mermaid-1644.wav'),
    stems: {
      drums: getUserAudioUrl('23_Mixer/01_FRB_drums.mp3'),
      bass: getUserAudioUrl('23_Mixer/01_FRB_bass.mp3'),
      guitar: getUserAudioUrl('23_Mixer/01_FRB_guitars.mp3'),
      vocal: getUserAudioUrl('23_Mixer/01_FRB_vocals.mp3'),
    },
  },
  {
    id: 'song-7',
    title: 'Слипер',
    mix: getUserAudioUrl('23/02-Sleeper-1644.wav'),
    stems: {
      drums: getUserAudioUrl('23_Mixer/02_SL_drums.mp3'),
      bass: getUserAudioUrl('23_Mixer/02_SL_bass.mp3'),
      guitar: getUserAudioUrl('23_Mixer/02_SL_guitars.mp3'),
      vocal: getUserAudioUrl('23_Mixer/02_SL_vocals.mp3'),
    },
  },
  {
    id: 'song-8',
    title: 'Швайс',
    mix: getUserAudioUrl('23/03-Schweiz-1644.wav'),
    stems: {
      drums: getUserAudioUrl('23_Mixer/03_SH_drums.mp3'),
      bass: getUserAudioUrl('23_Mixer/03_SH_bass.mp3'),
      guitar: getUserAudioUrl('23_Mixer/03_SH_guitars.mp3'),
      vocal: getUserAudioUrl('23_Mixer/03_SH_vocals.mp3'),
    },
  },
];

export default function StemsPlayground() {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));

  // Состояние для динамически загруженных песен
  const [dynamicSongs, setDynamicSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);

  // Используем только динамические песни (треки с загруженными стемами из базы)
  // Статические песни оставляем только как fallback для currentSong, если нет динамических
  const SONGS = useMemo(() => {
    // Если есть динамические песни, используем только их
    if (dynamicSongs.length > 0) {
      return dynamicSongs;
    }
    // Fallback на статические, если динамических нет
    return STATIC_SONGS;
  }, [dynamicSongs]);

  // Инициализируем selectedId - используем первую динамическую или статическую песню
  const [selectedId, setSelectedId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState<Record<StemKind, boolean>>({
    drums: false,
    bass: false,
    guitar: false,
    vocal: false,
  });

  const { pathname } = useLocation();
  const origin =
    (typeof window !== 'undefined' && window.location.origin) || 'https://smolyanoechuchelko.ru';
  const canonical = `${origin}${pathname}`;

  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // Engine
  const engineRef = useRef<StemEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // Waveform interactions
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const currentSong = useMemo(() => SONGS.find((s) => s.id === selectedId), [selectedId, SONGS]);

  // Мемоизируем дефолтные портреты стемов, чтобы не вызывать функции при каждом рендере
  const defaultPortraits = useMemo(() => {
    return {
      drums: getDefaultStemPortrait('drums'),
      bass: getDefaultStemPortrait('bass'),
      guitar: getDefaultStemPortrait('guitar'),
      vocal: getDefaultStemPortrait('vocal'),
    };
  }, []); // Пустой массив зависимостей - портреты не зависят от состояния

  // Загружаем альбомы
  useEffect(() => {
    if (albumsStatus === 'idle' || albumsStatus === 'failed') {
      dispatch(fetchAlbums({ lang }));
    }
  }, [dispatch, lang, albumsStatus]);

  // Обработчик события обновления обложек стемов
  useEffect(() => {
    const handleStemCoverUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        albumId: string;
        trackId: string;
        stemKey: string;
        url: string | null;
      }>;
      console.log(
        '🔄 [StemsPlayground] Получено событие обновления обложки стема:',
        customEvent.detail
      );

      // Перезагружаем альбомы с force: true для принудительной перезагрузки данных
      // Это вызовет useEffect, который перезагрузит стемы и портреты
      dispatch(fetchAlbums({ lang, force: true }));
    };

    window.addEventListener('stem-cover-updated', handleStemCoverUpdate);

    return () => {
      window.removeEventListener('stem-cover-updated', handleStemCoverUpdate);
    };
  }, [dispatch, lang]);

  // Загружаем стемы для треков из базы
  useEffect(() => {
    if (!albums || albums.length === 0) {
      setLoadingSongs(false);
      return;
    }

    const loadStemsForTracks = async () => {
      setLoadingSongs(true);
      const songsWithStems: Song[] = [];

      // Получаем UUID пользователя динамически или используем fallback
      // После миграции на UUID используем getUserUserId() или CURRENT_USER_CONFIG.userId
      const storageUserId = getUserUserId() || CURRENT_USER_CONFIG.userId;

      console.log('🎵 [StemsPlayground] Загрузка стемов для треков из альбомов:', {
        albumsCount: albums.length,
        albums: albums.map((a) => ({ albumId: a.albumId, tracksCount: a.tracks?.length || 0 })),
      });

      for (const album of albums) {
        if (!album.albumId || !album.tracks || album.tracks.length === 0) continue;

        for (const track of album.tracks) {
          const trackId = String(track.id);
          const albumId = album.albumId;

          // Проверяем наличие стемов в Storage
          const audioFolderPath = `users/${storageUserId}/audio/${albumId}/${trackId}`;
          console.log('🔍 [StemsPlayground] Проверка стемов для трека:', {
            albumId,
            trackId,
            trackTitle: track.title,
            audioFolderPath,
          });

          const stemsFiles = await listStorageByPrefix(audioFolderPath);

          // Если стемов нет, пропускаем трек
          if (!stemsFiles || stemsFiles.length === 0) {
            console.log('⚠️ [StemsPlayground] Стемы не найдены для трека:', {
              albumId,
              trackId,
              trackTitle: track.title,
            });
            continue;
          }

          console.log('✅ [StemsPlayground] Найдены стемы для трека:', {
            albumId,
            trackId,
            trackTitle: track.title,
            stemsCount: stemsFiles.length,
            stemsFiles,
          });

          // Формируем объект со стемами
          const stems: Partial<Record<StemKind, string>> = {};
          for (const [adminKey, stemKind] of Object.entries(STEM_KEY_MAP)) {
            // Ищем файл, который начинается с ключа стема (например, "drums-", "bass-")
            const matchingFile = stemsFiles.find((fileName) => fileName.startsWith(`${adminKey}-`));
            if (matchingFile) {
              const storagePath = `${audioFolderPath}/${matchingFile}`;
              const supabase = createSupabaseClient();
              if (supabase) {
                const { data: urlData } = supabase.storage
                  .from(STORAGE_BUCKET_NAME)
                  .getPublicUrl(storagePath);
                if (urlData?.publicUrl) {
                  stems[stemKind] = urlData.publicUrl;
                }
              }
            }
          }

          // Если хотя бы один стем найден, добавляем песню
          if (Object.keys(stems).length > 0) {
            // Загружаем портреты стемов из админки
            const portraitsFolderPath = `users/${storageUserId}/stems/${albumId}/${trackId}`;
            const portraitFiles = await listStorageByPrefix(portraitsFolderPath);
            const portraits: Partial<Record<StemKind, string>> = {};

            // Для каждого загруженного стема пытаемся найти пользовательский портрет,
            // если нет - используем дефолтный из папки Mixer
            for (const [adminKey, stemKind] of Object.entries(STEM_KEY_MAP)) {
              // Сначала проверяем, есть ли пользовательский портрет
              let portraitUrl: string | undefined;

              if (portraitFiles && portraitFiles.length > 0) {
                // Ищем файл обложки: может быть в формате "drums.jpg" или "drums-{timestamp}.jpg"
                const matchingFile = portraitFiles.find(
                  (fileName) =>
                    fileName.startsWith(`${adminKey}-`) ||
                    fileName.startsWith(`${adminKey}.`) ||
                    fileName === adminKey
                );
                if (matchingFile) {
                  // Формируем путь для портрета (полный путь в Storage)
                  const portraitStoragePath = `users/${storageUserId}/stems/${albumId}/${trackId}/${matchingFile}`;
                  const supabasePortrait = createSupabaseClient();
                  if (supabasePortrait) {
                    const { data: portraitUrlData } = supabasePortrait.storage
                      .from(STORAGE_BUCKET_NAME)
                      .getPublicUrl(portraitStoragePath);
                    if (portraitUrlData?.publicUrl) {
                      portraitUrl = portraitUrlData.publicUrl;
                    }
                  }
                }
              }

              // Если нет пользовательского портрета, используем дефолтный из Mixer
              // Но только если стем загружен (иначе карточка будет disabled)
              if (!portraitUrl && stems[stemKind]) {
                portraitUrl = getDefaultStemPortrait(stemKind);
              }

              if (portraitUrl) {
                portraits[stemKind] = portraitUrl;
              }
            }

            // Формируем URL для микса (полный трек)
            const mixUrl = track.src ? getUserAudioUrl(track.src, true) : undefined;

            songsWithStems.push({
              id: `track-${albumId}-${trackId}`,
              title: track.title || `Track ${trackId}`,
              mix: mixUrl,
              stems, // Partial - не все стемы обязательны
              portraits: Object.keys(portraits).length > 0 ? portraits : undefined,
            });
          }
        }
      }

      setDynamicSongs(songsWithStems);
      setLoadingSongs(false);

      // Если есть динамические песни, выбираем первую динамическую
      // Если нет динамических, используем первую статическую как fallback
      if (songsWithStems.length > 0) {
        setSelectedId(songsWithStems[0].id);
      } else if (STATIC_SONGS.length > 0 && !selectedId) {
        // Fallback на статические песни только если нет динамических и selectedId еще не установлен
        setSelectedId(STATIC_SONGS[0].id);
      }
    };

    loadStemsForTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albums]);

  // Обновляем selectedId если динамические песни изменились
  useEffect(() => {
    // Если выбрана статическая песня, но появились динамические - переключаемся на первую динамическую
    if (dynamicSongs.length > 0) {
      const isStaticSelected = STATIC_SONGS.some((s) => s.id === selectedId);
      if (isStaticSelected || !dynamicSongs.find((s) => s.id === selectedId)) {
        setSelectedId(dynamicSongs[0].id);
      }
    }
    // Если динамических нет, но selectedId не установлен, используем первую статическую
    else if (dynamicSongs.length === 0 && !selectedId && STATIC_SONGS.length > 0) {
      setSelectedId(STATIC_SONGS[0].id);
    }
  }, [dynamicSongs, selectedId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  // Создаём/перезагружаем движок при смене трека
  useEffect(() => {
    const song = currentSong;
    if (!song) return;

    // Фильтруем стемы: оставляем только те, у которых есть валидный URL
    const validStems: Partial<Record<StemKind, string>> = {};
    (Object.keys(song.stems) as StemKind[]).forEach((kind) => {
      const url = song.stems[kind];
      if (url && typeof url === 'string' && url.trim() !== '') {
        validStems[kind] = url;
      }
    });

    // Если нет ни одного валидного стема, не создаем движок
    if (Object.keys(validStems).length === 0) {
      console.warn('⚠️ [StemsPlayground] Нет валидных стемов для песни:', song.id, song.title);
      setLoading(false);
      return;
    }

    console.log('🎵 [StemsPlayground] Загрузка стемов для песни:', {
      songId: song.id,
      songTitle: song.title,
      stems: validStems,
    });

    setLoading(true);
    setLoadProgress(0);

    engineRef.current?.dispose();

    const engine = new StemEngine(validStems);
    engineRef.current = engine;

    (async () => {
      try {
        await engine.loadAll((p) => setLoadProgress(p));
        console.log('✅ [StemsPlayground] Стемы успешно загружены');
        setLoading(false);
        if (isPlaying) engine.play();
        (Object.keys(muted) as StemKind[]).forEach((k) => engine.setMuted(k, muted[k]));
      } catch (error) {
        console.error('❌ [StemsPlayground] Ошибка при загрузке стемов:', error);
        console.error('Стемы, которые пытались загрузить:', validStems);
        setLoading(false);
        // Можно показать ошибку пользователю
      }
    })();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // RAF-цикл для прогресса
  const [time, setTime] = useState({ current: 0, duration: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const e = engineRef.current;
      if (e) {
        setTime({ current: e.getCurrentTime(), duration: e.getDuration() });
        if (e.getDuration() > 0 && e.getCurrentTime() + 0.02 >= e.getDuration() && e.isPlaying) {
          setIsPlaying(false);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const progress = time.duration > 0 ? time.current / time.duration : 0;
  const waveformSrc = currentSong?.mix ?? currentSong?.stems.vocal ?? currentSong?.stems.drums;

  // Транспорт
  const togglePlay = async () => {
    const e = engineRef.current;
    if (!e || loading) return;
    if (!isPlaying) {
      await e.play();
      setIsPlaying(true);
    } else {
      await e.pause();
      setIsPlaying(false);
    }
  };

  // Mute
  const toggleMute = (stem: StemKind) => {
    const e = engineRef.current;
    if (!e) return;
    setMuted((m) => {
      const next = { ...m, [stem]: !m[stem] };
      e.setMuted(stem, next[stem]);
      return next;
    });
  };

  // Скраббинг
  const seekToClientX = (clientX: number) => {
    const wrap = waveWrapRef.current;
    const e = engineRef.current;
    if (!wrap || !e || !Number.isFinite(e.getDuration())) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const newTime = ratio * e.getDuration();

    e.seek(newTime);
    setTime((t) => ({ ...t, current: newTime }));
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (loading) return;
    draggingRef.current = true;
    wasPlayingRef.current = isPlaying;
    evt.currentTarget.setPointerCapture(evt.pointerId);
    seekToClientX(evt.clientX);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    if (!draggingRef.current || loading) return;
    seekToClientX(evt.clientX);
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (evt) => {
    draggingRef.current = false;
    evt.currentTarget.releasePointerCapture(evt.pointerId);
    if (wasPlayingRef.current && !isPlaying) return;
  };

  const selectDisabled = isPlaying || loading;

  const b = ui?.buttons ?? {};
  const pageTitle = (ui?.stems?.pageTitle as string) ?? '';
  const pageText = (ui?.stems?.text as string) || '';
  const notice = (ui?.stems?.notice as string) || '';

  const labels = {
    play: (b.playButton as string) ?? 'Play',
    pause: (b.pause as string) ?? 'Pause',
    drums: (b.drums as string) ?? 'Drums',
    bass: (b.bass as string) ?? 'Bass',
    guitar: (b.guitar as string) ?? 'Guitar',
    vocals: (b.vocals as string) ?? 'Vocals',
    pageTitle,
    pageText,
    notice,
  };

  return (
    <section className="stems-page main-background" aria-label="Блок c миксером">
      <Helmet>
        <title>{labels.pageTitle}</title>
        <meta name="description" content={labels.pageText} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={labels.pageTitle} />
        <meta property="og:description" content={labels.pageText} />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={labels.pageTitle} />
        <meta name="twitter:description" content={labels.pageText} />
      </Helmet>

      <div className="wrapper stems__wrapper">
        <h2 className="item-type-a">{labels.pageTitle}</h2>
        <Text className="item-type-a">{labels.pageText}</Text>
        <Text as="span" className="item-type-a notice" aria-label="Важная информация">
          {labels.notice}
        </Text>

        {/* выбор песни */}
        <div className="item">
          <div
            className={clsx('select-control', { 'is-disabled': selectDisabled })}
            aria-disabled={selectDisabled}
          >
            <select
              id="song-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Выбор песни"
              disabled={selectDisabled}
            >
              {/* Показываем только динамические песни (треки с загруженными стемами) */}
              {dynamicSongs.map((s) => (
                <option key={s.id} value={s.id} title={s.title}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* транспорт */}
        <div className="item">
          <div className="wrapper-transport-controls">
            <button
              className="btn"
              onClick={togglePlay}
              type="button"
              disabled={loading}
              aria-pressed={isPlaying}
            >
              <span
                className={clsx(isPlaying ? 'icon-controller-pause' : 'icon-controller-play')}
              ></span>
              {isPlaying ? labels.pause : labels.play}
            </button>
          </div>
        </div>

        {/* ВОЛНА или ЛОАДЕР */}
        <div
          ref={waveWrapRef}
          className={clsx('stems__wave-wrap', 'item-type-a', { 'is-loading': loading })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {loading ? (
            <div className="stems__loader in-wave" aria-live="polite" aria-busy="true">
              <div className="stems__loader-bar">
                <div
                  className="stems__loader-fill"
                  style={{ transform: `scaleX(${loadProgress})` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Waveform src={waveformSrc} progress={progress} height={64} />
              <div className="stems__wave-cursor" style={{ left: `${progress * 100}%` }} />
            </>
          )}
        </div>

        {/* портреты-мутизаторы */}
        <div className="stems__grid item-type-a">
          <StemCard
            title={labels.drums}
            img={
              currentSong?.portraits?.drums ||
              (currentSong?.stems?.drums ? defaultPortraits.drums : undefined)
            }
            active={!muted.drums}
            disabled={!currentSong?.stems?.drums}
            onClick={() => toggleMute('drums')}
          />
          <StemCard
            title={labels.bass}
            img={
              currentSong?.portraits?.bass ||
              (currentSong?.stems?.bass ? defaultPortraits.bass : undefined)
            }
            active={!muted.bass}
            disabled={!currentSong?.stems?.bass}
            onClick={() => toggleMute('bass')}
          />
          <StemCard
            title={labels.guitar}
            img={
              currentSong?.portraits?.guitar ||
              (currentSong?.stems?.guitar ? defaultPortraits.guitar : undefined)
            }
            active={!muted.guitar}
            disabled={!currentSong?.stems?.guitar}
            onClick={() => toggleMute('guitar')}
          />
          <StemCard
            title={labels.vocals}
            img={
              currentSong?.portraits?.vocal ||
              (currentSong?.stems?.vocal ? defaultPortraits.vocal : undefined)
            }
            active={!muted.vocal}
            disabled={!currentSong?.stems?.vocal}
            onClick={() => toggleMute('vocal')}
          />
        </div>
      </div>
    </section>
  );
}

function StemCard({
  title,
  img,
  active,
  disabled = false,
  onClick,
}: {
  title: string;
  img?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx('stem-card', { muted: !active, 'is-disabled': disabled })}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={
        disabled
          ? `${title}: стем не загружен`
          : `${title}: ${active ? 'звук включён' : 'звук выключен (mute)'}`
      }
      title={
        disabled
          ? `${title} — стем не загружен`
          : `${title} — ${active ? 'звук включён' : 'звук выключен (mute)'}`
      }
    >
      <div
        className="stem-card__img"
        style={{ backgroundImage: img ? `url(${img})` : undefined }}
      />
      <div className="stem-card__label">
        <span className="dot" />
        {title}
      </div>
    </button>
  );
}
