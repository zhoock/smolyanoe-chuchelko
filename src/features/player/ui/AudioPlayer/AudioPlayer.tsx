// src/features/player/ui/AudioPlayer/AudioPlayer.tsx
/**
 * Компонент аудиоплеера.
 * Отвечает только за отображение UI - вся логика воспроизведения находится в Redux и middleware.
 * Компонент получает данные из стейта через селекторы и диспатчит действия для управления плеером.
 */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { AlbumCover } from '@entities/album';
import type { IAlbums } from 'models';
import './style.scss';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, playerSelectors } from '@features/player';
import { audioController } from '@features/player/model/lib/audioController';
import { clearImageColorCache } from '@shared/lib/hooks/useImageColor';

export default function AudioPlayer({
  album,
  setBgColor,
}: {
  album: IAlbums; // Данные об альбоме (название, артист, обложка, треки)
  setBgColor: (color: string) => void; // Функция для установки фонового цвета попапа (градиент из цветов обложки)
}) {
  // Получаем функцию для диспатча действий
  const dispatch = useAppDispatch();

  // Получаем все данные о плеере из Redux стейта через селекторы
  const isPlaying = useAppSelector(playerSelectors.selectIsPlaying); // играет ли трек
  const progress = useAppSelector(playerSelectors.selectProgress); // прогресс воспроизведения (0-100%)
  const volume = useAppSelector(playerSelectors.selectVolume); // громкость (0-100)
  const isSeeking = useAppSelector(playerSelectors.selectIsSeeking); // перематывает ли пользователь
  const time = useAppSelector(playerSelectors.selectTime); // текущее время и длительность
  const currentTrackIndex = useAppSelector(playerSelectors.selectCurrentTrackIndex); // индекс текущего трека
  const playlist = useAppSelector(playerSelectors.selectPlaylist); // массив треков текущего альбома
  const currentTrack = useAppSelector(playerSelectors.selectCurrentTrack); // объект текущего трека

  /**
   * Вычисляем уникальный ID альбома для аналитики и ключей.
   * Мемоизируем чтобы не пересчитывать при каждом рендере.
   */
  const albumId = useMemo(
    () => album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-'),
    [album.albumId, album.artist, album.album]
  );

  // Refs для работы с DOM элементами и хранения промежуточных значений
  const audioContainerRef = useRef<HTMLDivElement | null>(null); // контейнер для прикрепления audio элемента к DOM
  const progressInputRef = useRef<HTMLInputElement | null>(null); // слайдер прогресса для установки CSS переменной
  const coverRef = useRef<HTMLDivElement | null>(null); // контейнер обложки для управления анимацией
  const prevIsPlayingRef = useRef<boolean | null>(null); // предыдущее состояние isPlaying (null = ещё не установлено)
  const prevTrackIndexRef = useRef<number | null>(null); // предыдущий индекс трека (null = ещё не установлено)
  const bgColorSetForAlbumRef = useRef<string | null>(null); // флаг: установлен ли уже цвет фона для текущего альбома

  /**
   * Прикрепляем глобальный audio элемент к DOM при монтировании компонента.
   * audioController.element - это единственный audio элемент на всё приложение (Singleton).
   * Нужен для работы аудио (без DOM элемента он не может воспроизводиться).
   */
  useEffect(() => {
    if (audioContainerRef.current && !audioContainerRef.current.contains(audioController.element)) {
      audioContainerRef.current.appendChild(audioController.element);
    }
  }, []);

  /**
   * Обновляем CSS переменную --progress-width для визуального отображения прогресса.
   * Обновляем только если пользователь НЕ перематывает трек вручную (isSeeking = false).
   */
  useEffect(() => {
    if (progressInputRef.current && !isSeeking) {
      progressInputRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress, isSeeking]);

  /**
   * Управление анимацией обложки альбома при play/pause и смене трека.
   * Используем прямую работу с DOM через classList чтобы избежать ненужных ре-рендеров.
   *
   * ВАЖНО:
   * - При первом рендере или смене трека синхронизируем класс с текущим isPlaying БЕЗ анимации (синхронно)
   * - При изменении isPlaying (play/pause) обновляем класс С анимацией
   * Это предотвращает анимацию увеличения при смене трека на паузе.
   */
  useEffect(() => {
    if (!coverRef.current) return;

    const element = coverRef.current;
    const expectedClass = isPlaying ? 'player__cover--playing' : 'player__cover--paused';
    const wasInitialized = prevIsPlayingRef.current !== null && prevTrackIndexRef.current !== null;
    const isPlayingChanged = wasInitialized && prevIsPlayingRef.current !== isPlaying;
    const trackChanged = wasInitialized && prevTrackIndexRef.current !== currentTrackIndex;

    // При первом рендере или смене трека синхронизируем класс с текущим isPlaying БЕЗ анимации
    if (!wasInitialized || trackChanged) {
      // Устанавливаем правильный класс синхронно, чтобы не было анимации
      element.classList.remove('player__cover--playing', 'player__cover--paused');
      element.classList.add(expectedClass);

      // Обновляем refs
      prevIsPlayingRef.current = isPlaying;
      prevTrackIndexRef.current = currentTrackIndex;
    } else if (isPlayingChanged) {
      // При изменении isPlaying (play/pause) обновляем класс С анимацией
      // Только если это не первый рендер и трек не менялся
      element.classList.remove('player__cover--playing', 'player__cover--paused');
      requestAnimationFrame(() => {
        if (element) {
          element.classList.add(expectedClass);
        }
      });
      prevIsPlayingRef.current = isPlaying;
    }
  }, [isPlaying, currentTrackIndex]);

  /**
   * Форматирует время в секундах в строку вида "MM:SS".
   * Мемоизируем чтобы не создавать функцию заново при каждом рендере.
   */
  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Переключает воспроизведение (play ↔ pause).
   * Мемоизируем чтобы не создавать функцию заново и не вызывать лишние ре-рендеры дочерних компонентов.
   */
  const togglePlayPause = useCallback(() => {
    dispatch(playerActions.toggle());
  }, [dispatch]);

  /**
   * Переключает на следующий трек в плейлисте.
   * Проверяем что плейлист не пуст перед переключением.
   */
  const nextTrack = useCallback(() => {
    if (playlist.length > 0) {
      dispatch(playerActions.nextTrack(playlist.length));
    }
  }, [dispatch, playlist.length]);

  /**
   * Переключает на предыдущий трек в плейлисте.
   * Проверяем что плейлист не пуст перед переключением.
   */
  const prevTrack = useCallback(() => {
    if (playlist.length > 0) {
      dispatch(playerActions.prevTrack(playlist.length));
    }
  }, [dispatch, playlist.length]);

  // Refs для перемотки при удержании кнопок
  const rewindIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartTimeRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // отдельный ref для таймера долгого нажатия
  const isLongPressRef = useRef(false);
  const wasRewindingRef = useRef(false); // флаг: была ли перемотка (чтобы предотвратить переключение трека после)
  const hasLongPressTimerRef = useRef(false); // флаг: запущен ли таймер долгого нажатия (чтобы предотвратить переключение трека даже если таймер ещё не сработал)
  const shouldBlockTrackSwitchRef = useRef(false); // флаг: блокировать ли переключение трека (устанавливается при начале перемотки)
  const timeRef = useRef(time); // ref для актуальных значений времени в setInterval

  // Обновляем ref при изменении time
  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  /**
   * Обработчик начала нажатия на кнопку перемотки (backward/forward).
   * Различает короткое нажатие (переключение трека) и долгое удержание (перемотка внутри трека).
   */
  const handleRewindStart = useCallback(
    (direction: 'backward' | 'forward') => {
      const startTime = Date.now();
      pressStartTimeRef.current = startTime;
      isLongPressRef.current = false;
      wasRewindingRef.current = false; // сбрасываем флаг перемотки
      hasLongPressTimerRef.current = false; // сбрасываем флаг запуска таймера
      shouldBlockTrackSwitchRef.current = false; // сбрасываем флаг блокировки (будет установлен при начале перемотки)

      // Очищаем предыдущий таймер, если он есть
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }

      // Помечаем, что таймер запущен (даже до его срабатывания)
      // Это предотвратит переключение трека при коротких нажатиях
      hasLongPressTimerRef.current = true;

      // Через 200мс начинаем перемотку, если кнопка всё ещё удерживается
      // Уменьшили время до 200мс для более быстрой реакции
      longPressTimerRef.current = setTimeout(() => {
        if (pressStartTimeRef.current === startTime) {
          // Это долгое нажатие - начинаем перемотку
          isLongPressRef.current = true;
          wasRewindingRef.current = true; // устанавливаем флаг что была перемотка
          shouldBlockTrackSwitchRef.current = true; // БЛОКИРУЕМ переключение трека раз и навсегда
          const step = direction === 'backward' ? -5 : 5; // перемотка на 5 секунд

          rewindIntervalRef.current = setInterval(() => {
            // Используем актуальные значения из ref
            const currentTime = timeRef.current.current || 0;
            const duration = timeRef.current.duration || 0;
            let newTime = currentTime + step;

            // Ограничиваем в пределах 0 - duration
            newTime = Math.max(0, Math.min(duration, newTime));

            const progress = (newTime / duration) * 100;

            dispatch(playerActions.setSeeking(true));
            dispatch(playerActions.setCurrentTime(newTime));
            dispatch(playerActions.setTime({ current: newTime, duration }));
            dispatch(playerActions.setProgress(progress));

            // Обновляем CSS переменную для синхронизации со слайдером
            if (progressInputRef.current) {
              progressInputRef.current.style.setProperty('--progress-width', `${progress}%`);
            }
          }, 200); // каждые 200мс
        }
      }, 200); // задержка перед началом перемотки (уменьшили с 300мс до 200мс)
    },
    [dispatch, time]
  );

  /**
   * Обработчик окончания нажатия на кнопку перемотки.
   * Если это было короткое нажатие - переключаем трек, если долгое - останавливаем перемотку.
   */
  const handleRewindEnd = useCallback(
    (direction: 'backward' | 'forward', originalHandler: () => void) => {
      const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;

      // КРИТИЧЕСКИ ВАЖНО: Сохраняем значение флага блокировки СРАЗУ, ДО всех операций
      // Это единственный источник правды - если он установлен, перемотка РАБОТАЛА
      const isRewindingActive = shouldBlockTrackSwitchRef.current;

      // Останавливаем таймер долгого нажатия
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Останавливаем перемотку
      if (rewindIntervalRef.current) {
        clearInterval(rewindIntervalRef.current);
        rewindIntervalRef.current = null;
        dispatch(playerActions.setSeeking(false));
        // Если трек играл, продолжаем воспроизведение
        if (isPlaying) {
          dispatch(playerActions.play());
        }
      }

      // ПРОСТАЯ ЛОГИКА: Если перемотка работала (флаг блокировки был установлен) - НЕ переключаем трек
      // Флаг устанавливается ТОЛЬКО когда перемотка реально началась (таймер сработал и интервал запущен)
      if (isRewindingActive) {
        // Перемотка работала - трек НЕ переключаем
        // Сбрасываем флаги и выходим
        setTimeout(() => {
          pressStartTimeRef.current = null;
          isLongPressRef.current = false;
          hasLongPressTimerRef.current = false;
          wasRewindingRef.current = false;
          // Сбрасываем флаг блокировки после всех проверок (даём время onClick проверить)
          setTimeout(() => {
            shouldBlockTrackSwitchRef.current = false;
          }, 300);
        }, 150);
        return;
      }

      // Если перемотка НЕ работала - проверяем, был ли это короткий клик
      // Переключаем трек ТОЛЬКО если нажатие было очень коротким (< 150мс)
      // Если нажатие >= 180мс, таймер мог сработать, поэтому не переключаем
      if (pressDuration > 0 && pressDuration < 150) {
        // Очень короткое нажатие - переключаем трек
        originalHandler();
      } else if (pressDuration >= 180) {
        // Нажатие было достаточно долгим - таймер мог сработать, не переключаем трек
        // Это дополнительная защита на случай гонки условий
      }
      // Средние нажатия (150-180мс) тоже не переключаем трек (на всякий случай)

      // Сбрасываем флаги с задержкой, чтобы onClick успел проверить
      setTimeout(() => {
        pressStartTimeRef.current = null;
        isLongPressRef.current = false;
        hasLongPressTimerRef.current = false;
        wasRewindingRef.current = false;
      }, 150);
    },
    [dispatch, isPlaying]
  );

  /**
   * Обработчик клика на кнопку перемотки (для обычного клика без долгого удержания).
   * Используется только если не было долгого нажатия и перемотки.
   */
  const handleRewindClick = useCallback(
    (direction: 'backward' | 'forward', originalHandler: () => void) => {
      // ПРОСТАЯ ЛОГИКА: Если перемотка работает (флаг блокировки установлен) - НЕ переключаем трек
      if (shouldBlockTrackSwitchRef.current) {
        return;
      }
      // Если перемотка НЕ работает - переключаем трек
      originalHandler();
    },
    []
  );

  /**
   * Обработчик изменения позиции слайдера прогресса (перемотка трека).
   * Вызывается пока пользователь перетаскивает слайдер.
   *
   * Что делает:
   * 1. Преобразует процент (0-100) в секунды
   * 2. Устанавливает флаг isSeeking = true (блокирует автообновление прогресса)
   * 3. Обновляет текущее время в стейте
   * 4. Обновляет CSS переменную для визуального отображения
   */
  const handleProgressChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const duration = time.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      const value = Number(event.target.value);
      const newTime = (value / 100) * duration;

      dispatch(playerActions.setSeeking(true));
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration }));
      dispatch(playerActions.setProgress(value));
      event.target.style.setProperty('--progress-width', `${value}%`);
    },
    [dispatch, time.duration]
  );

  /**
   * Обработчик окончания перемотки (когда пользователь отпустил слайдер).
   * Вызывается когда пользователь отпускает мышь/палец после перемотки.
   *
   * Что делает:
   * 1. Снимает флаг isSeeking (разрешает автообновление прогресса)
   * 2. Если трек играл, запускает его снова (может остановиться во время перемотки)
   */
  const handleSeekEnd = useCallback(() => {
    dispatch(playerActions.setSeeking(false));
    if (isPlaying) {
      dispatch(playerActions.play());
    }
  }, [dispatch, isPlaying]);

  /**
   * Обработчик изменения громкости.
   * Вызывается когда пользователь перемещает слайдер громкости.
   * Обновляет громкость в стейте и CSS переменную для визуального отображения.
   */
  const handleVolumeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = Number(event.target.value);
      dispatch(playerActions.setVolume(newVolume));
      event.target.style.setProperty('--volume-progress-width', `${newVolume}%`);
    },
    [dispatch]
  );

  /**
   * Обработчик извлечения цветов из обложки альбома.
   * Вызывается когда компонент AlbumCover извлекает доминантный цвет и палитру из изображения.
   *
   * Что делает:
   * 1. Проверяет что цвета ещё не установлены для этого альбома (предотвращает повторные вызовы)
   * 2. Устанавливает флаг что цвета установлены
   * 3. Создаёт градиент из доминантного цвета и 7-го цвета палитры и передаёт его в родительский компонент
   *    для установки фона попапа с плеером
   */
  const handleColorsExtracted = useCallback(
    ({ dominant, palette }: { dominant: string; palette: string[] }) => {
      if (bgColorSetForAlbumRef.current === albumId) return;

      bgColorSetForAlbumRef.current = albumId;
      setBgColor(`linear-gradient(var(--rotate, 132deg), ${dominant}, ${palette[6] || dominant})`);
    },
    [albumId, setBgColor]
  );

  /**
   * Очищаем кеш изображений при смене альбома.
   * Это нужно чтобы гарантировать переизвлечение цветов для нового альбома.
   * ВАЖНО: НЕ очищаем кеш при размонтировании компонента, только при смене альбома.
   */
  useEffect(() => {
    if (album.cover?.img) {
      clearImageColorCache(album.cover.img);
    }
    // Не делаем cleanup - кеш должен оставаться для следующего открытия попапа
  }, [albumId, album.cover?.img]);

  /**
   * Мемоизируем компонент обложки альбома.
   * Это предотвращает ненужные ре-рендеры когда другие части компонента обновляются.
   * Обложка пересоздаётся только если изменяются её пропсы (img, fullName, albumId, onColorsExtracted).
   */
  const memoizedAlbumCover = useMemo(
    () => (
      <AlbumCover
        key={albumId}
        {...album.cover}
        fullName={album.fullName}
        onColorsExtracted={handleColorsExtracted}
      />
    ),
    [albumId, album.cover, album.fullName, handleColorsExtracted]
  );

  /**
   * Сбрасываем флаг установки цвета фона когда меняется альбом.
   * Это нужно чтобы цвета установились заново для нового альбома.
   */
  useEffect(() => {
    // Сбрасываем флаг для нового альбома
    bgColorSetForAlbumRef.current = null;
  }, [albumId]);

  /**
   * Очищаем таймеры перемотки при размонтировании компонента.
   */
  useEffect(() => {
    return () => {
      if (rewindIntervalRef.current) {
        clearInterval(rewindIntervalRef.current);
        rewindIntervalRef.current = null;
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Сбрасываем флаги при размонтировании
      hasLongPressTimerRef.current = false;
      isLongPressRef.current = false;
      wasRewindingRef.current = false;
      pressStartTimeRef.current = null;
    };
  }, []);

  return (
    <div className="player">
      {/* Обложка альбома с анимацией при play/pause */}
      <div ref={coverRef} className="player__cover">
        {memoizedAlbumCover}
      </div>

      {/* Информация о текущем треке: название и артист */}
      <div className="player__track-info">
        <h2>{currentTrack?.title || 'Unknown Track'}</h2>
        <h3>{album.artist || 'Unknown Artist'}</h3>
      </div>

      {/* Прогресс воспроизведения: слайдер и время */}
      <div className="player__progress-container">
        <div className="player__progress-bar">
          <input
            ref={progressInputRef}
            type="range"
            value={progress}
            min="0"
            max="100"
            onChange={handleProgressChange}
            onMouseUp={handleSeekEnd} // для десктопа
            onTouchEnd={handleSeekEnd} // для мобильных
          />
        </div>
        {/* Время: текущее и оставшееся */}
        <div className="player__time-container">
          <span className="player__time">{formatTime(time.current)}</span>
          <span className="player__time">-{formatTime(time.duration - time.current)}</span>
        </div>
      </div>

      {/* Кнопки управления: предыдущий трек, play/pause, следующий трек */}
      <div className="player__controls">
        <button
          onMouseDown={(e) => {
            e.preventDefault(); // Предотвращаем focus и клик при удержании
            handleRewindStart('backward');
          }}
          onMouseUp={() => handleRewindEnd('backward', prevTrack)}
          onMouseLeave={() => handleRewindEnd('backward', prevTrack)}
          onTouchStart={(e) => {
            e.preventDefault(); // Предотвращаем клик при touch
            handleRewindStart('backward');
          }}
          onTouchEnd={(e) => {
            e.preventDefault(); // Предотвращаем двойной вызов
            handleRewindEnd('backward', prevTrack);
          }}
          onClick={(e) => {
            // ПРОСТАЯ ЛОГИКА: Если перемотка работает (флаг блокировки установлен) - блокируем клик
            // Проверяем ДО вызова handleRewindClick
            if (shouldBlockTrackSwitchRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            // Если перемотка НЕ работает - переключаем трек
            handleRewindClick('backward', prevTrack);
          }}
        >
          <span className="icon-controller-fast-backward"></span>
        </button>
        <button onClick={togglePlayPause}>
          {isPlaying ? (
            <span className="icon-controller-pause"></span>
          ) : (
            <span className="icon-controller-play"></span>
          )}
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault(); // Предотвращаем focus и клик при удержании
            handleRewindStart('forward');
          }}
          onMouseUp={() => handleRewindEnd('forward', nextTrack)}
          onMouseLeave={() => handleRewindEnd('forward', nextTrack)}
          onTouchStart={(e) => {
            e.preventDefault(); // Предотвращаем клик при touch
            handleRewindStart('forward');
          }}
          onTouchEnd={(e) => {
            e.preventDefault(); // Предотвращаем двойной вызов
            handleRewindEnd('forward', nextTrack);
          }}
          onClick={(e) => {
            // ПРОСТАЯ ЛОГИКА: Если перемотка работает (флаг блокировки установлен) - блокируем клик
            // Проверяем ДО вызова handleRewindClick
            if (shouldBlockTrackSwitchRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            // Если перемотка НЕ работает - переключаем трек
            handleRewindClick('forward', nextTrack);
          }}
        >
          <span className="icon-controller-fast-forward"></span>
        </button>
      </div>

      {/* Контрол громкости (скрыт на мобильных устройствах) */}
      <div className="player__volume-control">
        <span className="icon-volume-mute"></span>
        <input type="range" value={volume} min="0" max="100" onChange={handleVolumeChange} />
        <span className="icon-volume-hight"></span>
      </div>

      {/* Невидимый контейнер для прикрепления audio элемента к DOM */}
      <div ref={audioContainerRef} style={{ display: 'none' }} />
    </div>
  );
}
