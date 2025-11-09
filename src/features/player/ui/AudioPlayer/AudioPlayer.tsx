// src/features/player/ui/AudioPlayer/AudioPlayer.tsx
/**
 * Компонент аудиоплеера.
 * Отвечает только за отображение UI - вся логика воспроизведения находится в Redux и middleware.
 * Компонент получает данные из стейта через селекторы и диспатчит действия для управления плеером.
 */
import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { AlbumCover } from '@entities/album';
import type { IAlbums, SyncedLyricsLine } from 'models';
import './style.scss';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, playerSelectors } from '@features/player';
import { audioController } from '@features/player/model/lib/audioController';
import { clearImageColorCache } from '@shared/lib/hooks/useImageColor';
import {
  loadSyncedLyricsFromStorage,
  loadAuthorshipFromStorage,
} from '../../../../utils/syncedLyrics';
import { useLang } from '../../../../contexts/lang';

// Helper для debug-логов только в development
const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const formatTimerValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '--:--';
  }

  const safeSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

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
  // Используем один селектор для получения обоих значений времени атомарно
  // Это гарантирует синхронное обновление текущего и оставшегося времени
  const time = useAppSelector(playerSelectors.selectTime);
  const currentTrackIndex = useAppSelector(playerSelectors.selectCurrentTrackIndex); // индекс текущего трека
  const playlist = useAppSelector(playerSelectors.selectPlaylist); // массив треков текущего альбома
  const currentTrack = useAppSelector(playerSelectors.selectCurrentTrack); // объект текущего трека
  const shuffle = useAppSelector(playerSelectors.selectShuffle); // включено ли перемешивание треков
  const repeat = useAppSelector(playerSelectors.selectRepeat); // режим зацикливания: 'none' | 'all' | 'one'

  const INACTIVITY_TIMEOUT = 5000;

  // Состояние для синхронизированного текста
  const { lang } = useLang();
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyricsLine[] | null>(null);
  const [authorshipText, setAuthorshipText] = useState<string | null>(null); // текст авторства
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [showLyrics, setShowLyrics] = useState(false); // показывать ли текст песни

  // Refs для автоскролла синхронизированного текста
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Ref для отслеживания ручной прокрутки пользователя
  const userScrollTimestampRef = useRef<number>(0);
  const isUserScrollingRef = useRef<boolean>(false);
  const suppressActiveLineRef = useRef<boolean>(false);
  // Ref для отслеживания направления прокрутки
  const lastScrollTopRef = useRef<number>(0);
  const lastScrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const manualScrollRafRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef<number>(0);
  // Ref для отслеживания, прокрутил ли пользователь текст до конца
  const userScrolledToEndRef = useRef<boolean>(false);
  // Состояние режима прозрачности текста: 'normal' | 'user-scrolling' | 'seeking'
  const [lyricsOpacityMode, setLyricsOpacityMode] = useState<
    'normal' | 'user-scrolling' | 'seeking'
  >('normal');
  // Состояние видимости контролов плеера (скрываются после 5 секунд бездействия)
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsVisibleRef = useRef<boolean>(true);
  useEffect(() => {
    controlsVisibleRef.current = controlsVisible;
  }, [controlsVisible]);

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
  const prevIsPlayingRef = useRef<boolean | null>(null); // предыдущее состояние isPlaying (null = ещё не установлено)
  const prevTrackIndexRef = useRef<number | null>(null); // предыдущий индекс трека (null = ещё не установлено)
  const isIOSDevice = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  const isCoarsePointerDevice = useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }, []);

  const isSeekingRef = useRef<boolean>(isSeeking);
  const seekProtectionUntilRef = useRef<number>(0);
  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  const bgColorSetForAlbumRef = useRef<string | null>(null); // флаг: установлен ли уже цвет фона для текущего альбома
  const prevTrackIdRef = useRef<string | number | null>(null); // предыдущий ID трека для отслеживания смены трека
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // таймер для скрытия контролов после бездействия
  const playerContainerRef = useRef<HTMLDivElement | null>(null); // контейнер плеера для отслеживания активности
  const lastAutoScrollTimeRef = useRef<number>(0); // время последнего автоскролла для throttling
  const autoScrollRafRef = useRef<number | null>(null); // ref для requestAnimationFrame
  const smoothScrollAnimationRef = useRef<number | null>(null); // ref для плавной анимации скролла
  const smoothScrollStartRef = useRef<number>(0); // начальная позиция скролла
  const smoothScrollTargetRef = useRef<number>(0); // целевая позиция скролла
  const smoothScrollStartTimeRef = useRef<number>(0); // время начала анимации
  const previousPlaybackStateRef = useRef<boolean>(isPlaying);
  const updateLyricsReservedSpace = useCallback(() => {
    const containerEl = playerContainerRef.current;
    const lyricsEl = lyricsContainerRef.current;

    if (!containerEl || !lyricsEl) {
      return;
    }

    const playerRect = containerEl.getBoundingClientRect();
    const lyricsRect = lyricsEl.getBoundingClientRect();

    if (playerRect.width === 0 && playerRect.height === 0) {
      return;
    }

    const controlsHeight = Math.max(0, Math.ceil(playerRect.bottom - lyricsRect.bottom));
    const extraSpacing = Math.min(72, Math.max(24, Math.round(playerRect.height * 0.04)));
    const reservedSpace = controlsHeight + extraSpacing;
    const reservedSpaceValue = `${reservedSpace}px`;

    if (lyricsEl.style.getPropertyValue('--controls-reserved-space') !== reservedSpaceValue) {
      lyricsEl.style.setProperty('--controls-reserved-space', reservedSpaceValue);
    }
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const lyricsEl = lyricsContainerRef.current;
    const containerEl = playerContainerRef.current;

    if (!showLyrics || !lyricsEl || !containerEl) {
      if (lyricsEl) {
        lyricsEl.style.removeProperty('--controls-reserved-space');
      }
      return;
    }

    let frameId: number | null = null;

    const scheduleUpdate = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        updateLyricsReservedSpace();
        frameId = null;
      });
    };

    scheduleUpdate();

    const observedElements: Element[] = [];
    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleUpdate();
      });

      resizeObserver.observe(containerEl);
      observedElements.push(containerEl);

      resizeObserver.observe(lyricsEl);
      observedElements.push(lyricsEl);

      const trackedSelectors = [
        '.player__controls',
        '.player__progress-container',
        '.player__secondary-controls',
        '.player__volume-control',
      ];

      trackedSelectors.forEach((selector) => {
        const element = containerEl.querySelector(selector);
        if (element) {
          resizeObserver?.observe(element);
          observedElements.push(element);
        }
      });
    } else {
      window.addEventListener('resize', scheduleUpdate);
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      if (resizeObserver) {
        observedElements.forEach((element) => {
          resizeObserver?.unobserve(element);
        });
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', scheduleUpdate);
      }

      lyricsEl.style.removeProperty('--controls-reserved-space');
    };
  }, [showLyrics, controlsVisible, updateLyricsReservedSpace]);

  // Easing функция для плавного скролла (ease-out cubic)
  const easeOutCubic = useCallback((t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  }, []);

  // Функция плавного скролла (как в Apple Music) - только для iOS
  const smoothScrollTo = useCallback(
    (container: HTMLElement, targetScrollTop: number, duration: number = 600) => {
      // На десктопе используем нативный smooth scroll
      if (!isIOSDevice) {
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
        lastAutoScrollTimeRef.current = Date.now();
        return;
      }

      // На iOS используем кастомный плавный скролл
      // Отменяем предыдущую анимацию если она есть
      if (smoothScrollAnimationRef.current !== null) {
        cancelAnimationFrame(smoothScrollAnimationRef.current);
      }

      smoothScrollStartRef.current = container.scrollTop;
      smoothScrollTargetRef.current = targetScrollTop;
      smoothScrollStartTimeRef.current = performance.now();

      const animate = () => {
        const elapsed = performance.now() - smoothScrollStartTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);

        const currentScrollTop =
          smoothScrollStartRef.current +
          (smoothScrollTargetRef.current - smoothScrollStartRef.current) * easedProgress;

        // Используем scrollTo вместо прямого изменения scrollTop для стабильности маски
        container.scrollTo({
          top: currentScrollTop,
          behavior: 'auto',
        });

        if (progress < 1) {
          smoothScrollAnimationRef.current = requestAnimationFrame(animate);
        } else {
          smoothScrollAnimationRef.current = null;
          lastAutoScrollTimeRef.current = Date.now();
        }
      };

      smoothScrollAnimationRef.current = requestAnimationFrame(animate);
    },
    [easeOutCubic, isIOSDevice]
  );

  const resetLyricsViewToStart = useCallback(() => {
    const container = lyricsContainerRef.current;
    if (!container) {
      return;
    }

    suppressActiveLineRef.current = true;

    if (manualScrollRafRef.current !== null) {
      cancelAnimationFrame(manualScrollRafRef.current);
      manualScrollRafRef.current = null;
    }
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    if (smoothScrollAnimationRef.current !== null) {
      cancelAnimationFrame(smoothScrollAnimationRef.current);
      smoothScrollAnimationRef.current = null;
    }

    userScrollTimestampRef.current = 0;
    isUserScrollingRef.current = false;
    userScrolledToEndRef.current = false;
    lastScrollTopRef.current = 0;
    pendingScrollTopRef.current = 0;
    lastScrollDirectionRef.current = null;

    if (isIOSDevice) {
      smoothScrollTo(container, 0, 450);
    } else {
      container.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      lastAutoScrollTimeRef.current = Date.now();
    }

    setLyricsOpacityMode('normal');
  }, [isIOSDevice, smoothScrollTo]);

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
  const [coverAnimationClass, setCoverAnimationClass] = useState<string>(() =>
    isPlaying ? 'player__cover--playing' : 'player__cover--paused'
  );

  useEffect(() => {
    const expectedClass = isPlaying ? 'player__cover--playing' : 'player__cover--paused';
    setCoverAnimationClass(expectedClass);
    prevIsPlayingRef.current = isPlaying;
    prevTrackIndexRef.current = currentTrackIndex;
  }, [isPlaying, currentTrackIndex]);

  useEffect(() => {
    if (isPlaying) {
      suppressActiveLineRef.current = false;
    }
  }, [isPlaying]);

  useEffect(() => {
    const wasPlaying = previousPlaybackStateRef.current;
    previousPlaybackStateRef.current = isPlaying;

    if (!wasPlaying || isPlaying) {
      return;
    }

    if (repeat !== 'none') {
      return;
    }

    if (playlist.length === 0) {
      return;
    }

    const isLastTrack = currentTrackIndex === playlist.length - 1;
    if (!isLastTrack) {
      return;
    }

    const hasDuration = Number.isFinite(time.duration) && time.duration > 0;
    const reachedEnd =
      (hasDuration && time.current >= time.duration - 0.5) || progress >= 99.5;

    if (!reachedEnd) {
      return;
    }

    resetLyricsViewToStart();

    audioController.setCurrentTime(0);

    const timeContainer = timeDisplayRef.current;
    if (timeContainer) {
      const fragment = document.createDocumentFragment();

      const currentSpan = document.createElement('span');
      currentSpan.className = 'player__time-current';
      currentSpan.textContent = formatTimerValue(0);

      const remainingSpan = document.createElement('span');
      remainingSpan.className = 'player__time-remaining';
      remainingSpan.textContent = formatTimerValue(hasDuration ? time.duration : NaN);

      fragment.appendChild(currentSpan);
      fragment.appendChild(remainingSpan);
      timeContainer.replaceChildren(fragment);
    }

    if (hasDuration) {
      dispatch(playerActions.setTime({ current: 0, duration: time.duration }));
    } else {
      dispatch(playerActions.setTime({ current: 0, duration: NaN }));
    }
    dispatch(playerActions.setProgress(0));
  }, [
    isPlaying,
    repeat,
    playlist.length,
    currentTrackIndex,
    time.current,
    time.duration,
    progress,
    resetLyricsViewToStart,
    dispatch,
  ]);

  /**
   * Форматирует время в секундах в строку вида "MM:SS".
   * Мемоизируем чтобы не создавать функцию заново при каждом рендере.
   */
  const formatTime = useCallback((time: number) => {
    return formatTimerValue(time);
  }, []);

  const scheduleControlsHide = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (showLyrics && isPlaying) {
      inactivityTimerRef.current = setTimeout(() => {
        controlsVisibleRef.current = false;
        setControlsVisible(false);
      }, INACTIVITY_TIMEOUT);
    }
  }, [showLyrics, isPlaying]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    controlsVisibleRef.current = true;
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  // Функция для сброса таймера бездействия и показа контролов
  // ВАЖНО: таймер работает только в режиме показа текста И только при воспроизведении
  const resetInactivityTimer = useCallback(() => {
    showControls();
  }, [showControls]);

  /**
   * Переключает воспроизведение (play ↔ pause).
   * Мемоизируем чтобы не создавать функцию заново и не вызывать лишние ре-рендеры дочерних компонентов.
   */
  const togglePlayPause = useCallback(() => {
    dispatch(playerActions.toggle());
  }, [dispatch]);

  // Флаг для предотвращения повторных вызовов nextTrack из компонента
  // Проблема: при клике на кнопку одновременно срабатывают onClick и onMouseUp,
  // что вызывает nextTrack дважды. Эта защита блокирует повторные вызовы.
  const nextTrackCallRef = useRef<string | null>(null);

  /**
   * Переключает на следующий трек в плейлисте.
   * Проверяем что плейлист не пуст перед переключением.
   * ВАЖНО: Защита от повторных вызовов - если уже был вызов в течение последних 500мс, игнорируем.
   */
  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return;

    // Генерируем уникальный ID для этого вызова
    const callId = `${Date.now()}-${Math.random()}`;

    // Проверяем, не был ли уже вызов в течение последних 500мс
    if (nextTrackCallRef.current !== null) {
      return;
    }

    // Сохраняем ID вызова
    nextTrackCallRef.current = callId;

    dispatch(playerActions.nextTrack(playlist.length));

    // Сбрасываем ID через 500мс
    setTimeout(() => {
      if (nextTrackCallRef.current === callId) {
        nextTrackCallRef.current = null;
      }
    }, 500);
  }, [dispatch, playlist.length]);

  // Флаг для предотвращения повторных вызовов prevTrack из компонента
  // Аналогично nextTrack, защита от одновременных вызовов onClick и onMouseUp
  const prevTrackCallRef = useRef<string | null>(null);

  /**
   * Переключает на предыдущий трек в плейлисте или начинает текущий трек с начала.
   * Логика:
   * - Если трек проигрывается меньше 3 секунд → переключает на предыдущий трек
   * - Если трек проигрывается 3 секунды и больше → начинает текущий трек с начала
   * ВАЖНО: Защита от повторных вызовов - если уже был вызов в течение последних 500мс, игнорируем.
   */
  const prevTrack = useCallback(() => {
    if (playlist.length === 0) return;

    // Генерируем уникальный ID для этого вызова
    const callId = `${Date.now()}-${Math.random()}`;

    // Проверяем, не был ли уже вызов в течение последних 500мс
    if (prevTrackCallRef.current !== null) {
      return;
    }

    // Сохраняем ID вызова
    prevTrackCallRef.current = callId;

    // Порог времени: если трек проигрывается меньше 3 секунд, переключаем на предыдущий
    const TIME_THRESHOLD = 3; // секунды
    const currentTimeValue = time.current;

    if (currentTimeValue < TIME_THRESHOLD) {
      // Трек только начал проигрываться → переключаем на предыдущий трек
      dispatch(playerActions.prevTrack(playlist.length));
    } else {
      // Трек уже проигрывается какое-то время → начинаем с начала
      dispatch(playerActions.setCurrentTime(0));
      audioController.setCurrentTime(0);
      dispatch(playerActions.setProgress(0));
    }

    // Сбрасываем ID через 500мс
    setTimeout(() => {
      if (prevTrackCallRef.current === callId) {
        prevTrackCallRef.current = null;
      }
    }, 500);
  }, [dispatch, playlist.length, time]);

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
      showControls();

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
          isSeekingRef.current = true;
          seekProtectionUntilRef.current = Date.now() + 2000;
          showControls();
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
            seekProtectionUntilRef.current = Date.now() + 2000;
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
        isSeekingRef.current = false;
        seekProtectionUntilRef.current = Date.now() + 1500;
        showControls();
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
  // Обработчик клика на строку текста для перемотки трека
  const handleLineClick = useCallback(
    (startTime: number) => {
      if (!time.duration || time.duration <= 0) return;

      suppressActiveLineRef.current = false;

      const newTime = Math.max(0, Math.min(time.duration, startTime));
      const progress = (newTime / time.duration) * 100;
      const shouldResumePlayback = !isPlaying;

      dispatch(playerActions.setSeeking(true));
      isSeekingRef.current = true;
      seekProtectionUntilRef.current = Date.now() + 2000;
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration: time.duration }));
      dispatch(playerActions.setProgress(progress));

      // Обновляем CSS переменную для синхронизации со слайдером
      if (progressInputRef.current) {
        progressInputRef.current.style.setProperty('--progress-width', `${progress}%`);
      }

      // Снимаем флаг isSeeking после перемотки
      // Если трек играл, продолжаем воспроизведение
      setTimeout(() => {
        dispatch(playerActions.setSeeking(false));
        isSeekingRef.current = false;
        seekProtectionUntilRef.current = Date.now() + 1500;
        if (isPlaying || shouldResumePlayback) {
          dispatch(playerActions.play());
        }
      }, 100);
    },
    [dispatch, time.duration, isPlaying]
  );

  const handleProgressChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const duration = time.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      suppressActiveLineRef.current = false;

      const value = Number(event.target.value);
      const newTime = (value / 100) * duration;

      dispatch(playerActions.setSeeking(true));
      // ЯВНО устанавливаем время в audio элементе сразу, не дожидаясь middleware
      // Это гарантирует, что аудио перематывается немедленно при клике на слайдер
      audioController.setCurrentTime(newTime);
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration }));
      dispatch(playerActions.setProgress(value));
      event.target.style.setProperty('--progress-width', `${value}%`);

      // Сбрасываем флаг ручной прокрутки при клике на прогрессбар,
      // чтобы автоскролл сработал немедленно и прокрутил текст к нужной позиции
      userScrollTimestampRef.current = 0;
      isUserScrollingRef.current = false;
      // Устанавливаем режим прозрачности для перетаскивания прогресс-бара
      setLyricsOpacityMode((prevMode) => {
        debugLog('🔍 Seeking started, prev mode:', prevMode, '-> seeking');
        return 'seeking';
      });
      // Сбрасываем таймер бездействия при взаимодействии с прогресс-баром
      resetInactivityTimer();
      isSeekingRef.current = true;
      seekProtectionUntilRef.current = Date.now() + 2000;
    },
    [dispatch, time.duration, resetInactivityTimer]
  );

  /**
   * Обработчик окончания перемотки (когда пользователь отпустил слайдер).
   * Вызывается когда пользователь отпускает мышь/палец после перемотки.
   *
   * Что делает:
   * 1. Снимает флаг isSeeking (разрешает автообновление прогресса)
   * 2. Если трек играл, запускает его снова (может остановиться во время перемотки)
   *
   * Используем небольшую задержку, чтобы дать Redux время обновиться после handleProgressChange
   */
  const handleSeekEnd = useCallback(() => {
    // Сразу снимаем флаг isSeeking (разрешает автообновление прогресса)
    dispatch(playerActions.setSeeking(false));
    isSeekingRef.current = false;
    if (isPlaying) {
      dispatch(playerActions.play());
    }
    seekProtectionUntilRef.current = Date.now() + 1500;
    // Возвращаем режим прозрачности к нормальному сразу после окончания перетаскивания
    // Только если пользователь не прокручивает вручную
    const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
    if (timeSinceUserScroll >= 2000) {
      setLyricsOpacityMode((prevMode) => {
        // Не сбрасываем, если пользователь активно прокручивает
        if (prevMode === 'user-scrolling') {
          debugLog('⚠️ handleSeekEnd: keeping user-scrolling mode');
          return prevMode;
        }
        debugLog('🔍 handleSeekEnd: resetting to normal');
        return 'normal';
      });
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
      // Сбрасываем таймер бездействия при взаимодействии с громкостью
      resetInactivityTimer();
    },
    [dispatch, resetInactivityTimer]
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
   *
   * ВАЖНО: key используется только для идентификации альбома, не для пересоздания при showLyrics.
   */
  const memoizedAlbumCover = useMemo(
    () => (
      <AlbumCover
        key={`album-cover-${albumId}`}
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

  // Загружаем синхронизации для текущего трека
  useEffect(() => {
    if (!currentTrack) {
      setSyncedLyrics(null);
      setCurrentLineIndex(null);
      return;
    }

    // Вычисляем albumId
    const albumIdComputed = albumId;

    // Загружаем синхронизации из localStorage (dev mode) или используем из JSON
    const storedSync = loadSyncedLyricsFromStorage(albumIdComputed, currentTrack.id, lang);
    const baseSynced = storedSync || currentTrack.syncedLyrics;

    if (baseSynced && baseSynced.length > 0) {
      // Загружаем авторство и добавляем его в конец массива строк, если оно есть
      const storedAuthorship = loadAuthorshipFromStorage(albumIdComputed, currentTrack.id, lang);
      const authorship = currentTrack.authorship || storedAuthorship;

      const synced = [...baseSynced];

      // Добавляем авторство в конец, если оно есть и ещё не добавлено
      if (authorship) {
        const lastLine = synced[synced.length - 1];
        // Проверяем, не является ли последняя строка уже авторством
        if (!lastLine || lastLine.text !== authorship) {
          synced.push({
            text: authorship,
            startTime: time.duration || 0,
            endTime: undefined,
          });
        }
      }

      setSyncedLyrics(synced);
      setAuthorshipText(authorship || null);
    } else {
      setSyncedLyrics(null);
      setAuthorshipText(null);
      setCurrentLineIndex(null);
    }
  }, [currentTrack, albumId, lang, time.duration]);

  /**
   * Автоматически скрываем текст при смене трека, если трек не добавлен в караоке.
   * Проверяем только наличие синхронизированного текста (syncedLyrics),
   * а не обычного текста (content).
   * ВАЖНО: Используем useRef для отслеживания смены трека, чтобы гарантировать срабатывание эффекта.
   * ВАЖНО: При скрытии текста также обновляем класс обложки, чтобы он соответствовал текущему isPlaying.
   */
  useEffect(() => {
    if (!currentTrack) {
      setShowLyrics(false);
      prevTrackIdRef.current = null;
      userScrolledToEndRef.current = false;
      return;
    }

    // Проверяем, изменился ли трек
    const currentTrackId = currentTrack.id;
    const trackChanged = prevTrackIdRef.current !== currentTrackId;

    // Если трек не изменился, не делаем ничего
    if (!trackChanged) {
      return;
    }

    // Обновляем ref для следующей проверки
    prevTrackIdRef.current = currentTrackId;
    // Сбрасываем режим прозрачности при смене трека
    setLyricsOpacityMode((prevMode) => {
      debugLog('🔍 Track changed, resetting opacity mode from:', prevMode);
      return 'normal';
    });
    // Сбрасываем флаг прокрутки до конца при смене трека
    userScrolledToEndRef.current = false;

    // Проверяем только синхронизированный текст (караоке), не обычный content
    // Используем ту же логику, что и при загрузке синхронизированного текста
    const albumIdComputed = albumId;
    const storedSync = loadSyncedLyricsFromStorage(albumIdComputed, currentTrack.id, lang);
    const baseSynced = storedSync || currentTrack.syncedLyrics;

    // Проверяем только наличие синхронизированного текста (караоке)
    // НЕ проверяем currentTrack.content, так как это обычный текст, не караоке
    const hasSyncedLyrics = baseSynced && baseSynced.length > 0;

    // Если трек не добавлен в караоке (нет синхронизированного текста) - скрываем текст
    if (!hasSyncedLyrics) {
      setShowLyrics(false);
    }
  }, [currentTrack, albumId, lang]);

  // Определяем текущую строку на основе времени воспроизведения
  // Используем useMemo для синхронного вычисления при каждом изменении времени
  const currentLineIndexComputed = useMemo(() => {
    if (!syncedLyrics || syncedLyrics.length === 0) {
      return null;
    }

    if (suppressActiveLineRef.current) {
      return null;
    }

    const timeValue = time.current;
    const lines = syncedLyrics;
    const firstLineStart = lines[0]?.startTime ?? 0;

    if (!isPlaying && timeValue <= firstLineStart + 0.05) {
      return null;
    }

    // Находим текущую строку: ищем строку, где time >= startTime и time < endTime
    let activeIndex: number | null = null;

    // Если время меньше startTime первой строки - нет активной строки (промежуток без текста в начале)
    if (lines.length > 0 && timeValue < lines[0].startTime) {
      activeIndex = null;
    } else {
      // Ищем активную строку среди всех строк
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        // Определяем границу окончания строки
        // Если endTime задан - используем его, иначе используем startTime следующей строки (или Infinity для последней)
        const lineEndTime =
          line.endTime !== undefined ? line.endTime : nextLine ? nextLine.startTime : Infinity;

        // Если время попадает в диапазон текущей строки
        // ВАЖНО: если endTime === startTime следующей строки, в момент t = endTime активна должна быть следующая строка
        // Поэтому для текущей строки используем строгое < для endTime
        if (timeValue >= line.startTime && timeValue < lineEndTime) {
          activeIndex = i;
          break;
        }

        // Специальная обработка: если endTime текущей строки === startTime следующей,
        // и время равно этому значению, то активна должна быть следующая строка
        // (это обработается на следующей итерации цикла)

        // Если это последняя строка
        if (!nextLine) {
          // Если время больше startTime последней строки - оставляем её активной
          // (даже если время прошло endTime - показываем последнюю строку до конца трека)
          if (timeValue >= line.startTime) {
            activeIndex = i;
            break;
          }
          // Если время меньше startTime последней строки - не устанавливаем активную строку
          break;
        }

        // Если есть следующая строка и время между текущей и следующей
        if (
          line.endTime !== undefined &&
          timeValue >= line.endTime &&
          timeValue < nextLine.startTime
        ) {
          // Промежуток между строками - показываем предыдущую (если она была и время в её диапазоне)
          if (i > 0) {
            const prevLine = lines[i - 1];
            if (
              timeValue >= prevLine.startTime &&
              (prevLine.endTime === undefined || timeValue < prevLine.endTime)
            ) {
              activeIndex = i - 1;
            }
          }
          break;
        }
      }
    }

    return activeIndex;
  }, [syncedLyrics, time.current, time.duration, isPlaying]);

  // Синхронизируем вычисленное значение с состоянием для совместимости
  useEffect(() => {
    setCurrentLineIndex(currentLineIndexComputed);
  }, [currentLineIndexComputed]);

  // Отслеживание ручной прокрутки пользователя
  useEffect(() => {
    // Ждем, пока контейнер будет готов (showLyrics может быть false при первом рендере)
    if (!showLyrics) {
      debugLog('⚠️ showLyrics is false, skipping scroll listener setup');
      return;
    }

    const container = lyricsContainerRef.current;
    if (!container) {
      debugLog('⚠️ Container not found, skipping scroll listener setup');
      return;
    }

    debugLog('✅ Scroll listener setup for container:', container);

    // Инициализируем начальные значения
    lastScrollTopRef.current = container.scrollTop;
    pendingScrollTopRef.current = container.scrollTop;
    lastScrollDirectionRef.current = null;
    manualScrollRafRef.current = null;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let directionTimeout: ReturnType<typeof setTimeout> | null = null;
    let isProgrammaticScroll = false; // Флаг для отслеживания программного скролла
    let scrollStartPosition = container.scrollTop;
    const IMMEDIATE_DIRECTION_THRESHOLD = 2;
    const STICKY_END_THRESHOLD = 24;

    const applyDirectionChange = (direction: 'up' | 'down') => {
      const now = Date.now();
      const isSeekProtectionActive = now < seekProtectionUntilRef.current;
      if (direction === 'down' && (isSeekingRef.current || isSeekProtectionActive)) {
        return;
      }
      if (direction === 'down') {
        let didHide = false;
        setControlsVisible((prev) => {
          if (!prev) {
            return prev;
          }
          didHide = true;
          return false;
        });
        if (didHide) {
          controlsVisibleRef.current = false;
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
          }
        }
      } else {
        showControls();
      }
    };

    const processScroll = (currentScrollTop: number) => {
      const now = Date.now();
      const isSeekProtectionActive = now < seekProtectionUntilRef.current;
      if (isSeekingRef.current || isSeekProtectionActive) {
        lastScrollTopRef.current = currentScrollTop;
        return;
      }
      debugLog('✅ Manual scroll detected!');

      // Отменяем любую активную анимацию скролла при ручной прокрутке
      if (smoothScrollAnimationRef.current !== null) {
        cancelAnimationFrame(smoothScrollAnimationRef.current);
        smoothScrollAnimationRef.current = null;
      }

      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const isAtEnd = currentScrollTop + clientHeight >= scrollHeight - 10; // 10px допуск
      const distanceFromBottom = Math.max(0, scrollHeight - clientHeight - currentScrollTop);
      const isNearStickyEnd = distanceFromBottom <= STICKY_END_THRESHOLD;
      const previousScrollTop = lastScrollTopRef.current;
      const scrollDelta = currentScrollTop - previousScrollTop;

      // Помечаем, что пользователь прокручивает вручную
      userScrollTimestampRef.current = Date.now();
      isUserScrollingRef.current = true;

      // Если пользователь прокрутил до конца, устанавливаем флаг
      if (isAtEnd) {
        userScrolledToEndRef.current = true;
        debugLog('📍 User scrolled to end');
      } else if (userScrolledToEndRef.current && distanceFromBottom > STICKY_END_THRESHOLD) {
        userScrolledToEndRef.current = false;
        debugLog('📍 User left end zone, reset flag');
      }

      // Устанавливаем режим прозрачности для ручной прокрутки
      setLyricsOpacityMode((prevMode) => {
        debugLog('🔍 User scrolling detected, prev mode:', prevMode, '-> user-scrolling');
        return 'user-scrolling';
      });

      if (Math.abs(scrollDelta) > IMMEDIATE_DIRECTION_THRESHOLD) {
        const direction = scrollDelta > 0 ? 'down' : 'up';
        let shouldReactImmediately =
          lastScrollDirectionRef.current !== direction ||
          (direction === 'down' && controlsVisibleRef.current) ||
          (direction === 'up' && !controlsVisibleRef.current);

        if (direction === 'up' && isNearStickyEnd) {
          shouldReactImmediately = false;
        }
        if (shouldReactImmediately) {
          applyDirectionChange(direction);
          lastScrollDirectionRef.current = direction;
        }
      }

      // Обновляем предыдущее значение scrollTop после обработки
      lastScrollTopRef.current = currentScrollTop;

      // Сбрасываем таймеры
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (directionTimeout) {
        clearTimeout(directionTimeout);
        directionTimeout = null;
      }

      scrollStartPosition = currentScrollTop;

      // Определяем направление только ПОСЛЕ окончания прокрутки (200мс после последнего события)
      // Это предотвращает зацикливание и дёргание анимации
      directionTimeout = setTimeout(() => {
        const finalScrollTop = container.scrollTop;
        const totalDelta = finalScrollTop - scrollStartPosition;
        const finalDistanceFromBottom = Math.max(0, scrollHeight - clientHeight - finalScrollTop);
        const finalIsNearStickyEnd = finalDistanceFromBottom <= STICKY_END_THRESHOLD;

        if (Math.abs(totalDelta) > 30) {
          if (isSeekingRef.current && totalDelta > 0) {
            scrollStartPosition = finalScrollTop;
            directionTimeout = null;
            return;
          }
          const finalDirection = totalDelta > 0 ? 'down' : 'up';
          let shouldReactFinal =
            lastScrollDirectionRef.current !== finalDirection ||
            (finalDirection === 'down' && controlsVisibleRef.current) ||
            (finalDirection === 'up' && !controlsVisibleRef.current);

          if (finalDirection === 'up' && finalIsNearStickyEnd) {
            shouldReactFinal = false;
          }
          if (shouldReactFinal) {
            applyDirectionChange(finalDirection);
            lastScrollDirectionRef.current = finalDirection;
          }
        }

        // Обновляем начальную позицию для следующей прокрутки
        scrollStartPosition = finalScrollTop;
        directionTimeout = null;
      }, 200); // Определяем направление 200мс после последнего scroll события

      // Устанавливаем таймер для возврата к нормальному режиму через 2 секунды после последнего скролла
      scrollTimeout = setTimeout(() => {
        setLyricsOpacityMode((prevMode) => {
          if (prevMode === 'user-scrolling') {
            isUserScrollingRef.current = false;
            debugLog('🔍 Scroll timeout, opacity mode reset to: normal');
            return 'normal';
          }
          return prevMode;
        });
      }, 2000);
    };

    const handleScroll = () => {
      // Если это программный скролл - игнорируем
      if (isProgrammaticScroll) {
        return;
      }

      if (isCoarsePointerDevice) {
        processScroll(container.scrollTop);
        return;
      }

      pendingScrollTopRef.current = container.scrollTop;

      if (manualScrollRafRef.current !== null) {
        return;
      }

      manualScrollRafRef.current = requestAnimationFrame(() => {
        manualScrollRafRef.current = null;
        processScroll(pendingScrollTopRef.current);
      });
    };

    // Перехватываем программный скролл
    const originalScrollTo = container.scrollTo.bind(container);
    container.scrollTo = function (optionsOrX?: ScrollToOptions | number, y?: number) {
      isProgrammaticScroll = true;

      if (typeof optionsOrX === 'number' && typeof y === 'number') {
        originalScrollTo(optionsOrX, y);
      } else if (optionsOrX !== undefined) {
        originalScrollTo(optionsOrX as ScrollToOptions);
      } else {
        originalScrollTo();
      }

      // Сбрасываем флаг и обновляем начальную позицию после завершения скролла
      // Используем задержку, чтобы дождаться завершения smooth scroll
      setTimeout(() => {
        isProgrammaticScroll = false;
        // Обновляем начальную позицию для отслеживания направления прокрутки
        scrollStartPosition = container.scrollTop;
      }, 300);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    debugLog('✅ Scroll event listener added');

    return () => {
      debugLog('🧹 Cleaning up scroll listener');
      container.removeEventListener('scroll', handleScroll);
      container.scrollTo = originalScrollTo;
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (directionTimeout) {
        clearTimeout(directionTimeout);
        directionTimeout = null;
      }
      if (manualScrollRafRef.current !== null) {
        cancelAnimationFrame(manualScrollRafRef.current);
        manualScrollRafRef.current = null;
      }
    };
  }, [showLyrics, resetInactivityTimer, isCoarsePointerDevice, showControls, scheduleControlsHide]); // Добавляем зависимости

  // Автоскролл к активной строке
  // Не скроллим, если пользователь недавно прокручивал вручную (в течение 2 секунд)
  // ВАЖНО: при резком изменении времени (клик на прогрессбар) нужно прокрутить к нужной позиции
  // Используем плавный скролл с easing функцией для максимальной плавности (как в Apple Music)
  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container || !syncedLyrics || syncedLyrics.length === 0) return;

    // Throttling: разный для iOS и десктопа
    const now = Date.now();
    const timeSinceLastScroll = now - lastAutoScrollTimeRef.current;
    const SCROLL_THROTTLE = isIOSDevice ? 50 : 50; // мс (уменьшили для iOS чтобы успевать за сменой строк)

    // Если currentLineIndex === null, проверяем, почему:
    // 1. Время до начала текста - прокручиваем к началу
    // 2. Время в промежутке между строками - не прокручиваем к началу, оставляем текущую позицию
    if (currentLineIndexComputed === null) {
      const timeValue = time.current;
      const firstLine = syncedLyrics[0];

      // Если время до начала первой строки - прокручиваем к началу
      if (timeValue < firstLine.startTime) {
        // Проверяем, не прокручивал ли пользователь вручную недавно
        const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
        const USER_SCROLL_TIMEOUT = 2000; // 2 секунды

        // Если пользователь прокручивал вручную недавно - не вмешиваемся
        if (timeSinceUserScroll < USER_SCROLL_TIMEOUT) {
          return;
        }

        // Throttling для скролла к началу
        if (timeSinceLastScroll < SCROLL_THROTTLE) {
          return;
        }

        // Используем плавный скролл
        smoothScrollTo(container, 0, isIOSDevice ? 300 : 300);
      }
      // Если время в промежутке между строками - не прокручиваем, оставляем текущую позицию
      // (заглушка будет показана, но прокрутка не изменится)
      return;
    }

    const lineElement = lineRefs.current.get(currentLineIndexComputed);
    if (!lineElement) return;

    // Проверяем, не прокручивал ли пользователь вручную недавно
    const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
    const USER_SCROLL_TIMEOUT = 2000; // 2 секунды
    const USER_SCROLL_RETURN_DELAY = 3500; // 3.5 секунды - после этого возвращаемся к активной строке даже если пользователь прокручивал далеко

    // Если пользователь прокручивал вручную недавно - не вмешиваемся
    if (timeSinceUserScroll < USER_SCROLL_TIMEOUT) {
      return;
    }

    // Если пользователь прокрутил до конца, проверяем, дошел ли трек до конца
    if (userScrolledToEndRef.current) {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      const isStillAtEnd = scrollTop + clientHeight >= scrollHeight - 10;

      // Если пользователь все еще в конце, проверяем, является ли текущая строка последней
      if (isStillAtEnd) {
        const isLastLine = currentLineIndexComputed === syncedLyrics.length - 1;
        const timeValue = time.current;
        const lastLine = syncedLyrics[syncedLyrics.length - 1];
        const lastLineEndTime = lastLine.endTime !== undefined ? lastLine.endTime : Infinity;

        // Если трек еще не дошел до конца последней строки - не возвращаемся к автоскроллу
        if (timeValue < lastLineEndTime) {
          if (timeSinceUserScroll < USER_SCROLL_RETURN_DELAY) {
            debugLog('📍 User at end (grace period), skipping auto-scroll');
            return;
          }
        }
        // Трек дошел до конца или истек период ожидания - разрешаем автоскролл
        userScrolledToEndRef.current = false;
        debugLog('📍 Allowing auto-scroll after user reached end');
      } else {
        // Пользователь больше не в конце - сбрасываем флаг
        userScrolledToEndRef.current = false;
      }
    }

    // Throttling: пропускаем если прошло мало времени с последнего скролла
    if (timeSinceLastScroll < SCROLL_THROTTLE) {
      return;
    }

    // НЕ сбрасываем режим прозрачности здесь - это делается в handleScroll через таймер
    // Просто сбрасываем флаг для логики автоскролла
    if (isUserScrollingRef.current && timeSinceUserScroll >= USER_SCROLL_TIMEOUT) {
      isUserScrollingRef.current = false;
    }

    const lineTop = lineElement.offsetTop;
    const lineHeight = lineElement.offsetHeight;
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;

    // Увеличенный отступ сверху, чтобы активная строка была выше (примерно 25-30% высоты контейнера)
    const topOffset = Math.min(containerHeight * 0.25, 120);
    // Отступ снизу (минимальный)
    const bottomOffset = Math.min(containerHeight * 0.1, 40);

    // Вычисляем желаемую позицию скролла (чтобы строка была на 25% от верха)
    const desiredScrollTop = Math.max(0, lineTop - topOffset);
    const currentLineTopRelative = lineTop - scrollTop;

    // Проверяем, находится ли строка в правильной позиции (около 25% от верха)
    const isInCorrectPosition = Math.abs(currentLineTopRelative - topOffset) <= 20;

    // Проверяем, полностью ли видна строка (не обрезана снизу)
    const isFullyVisibleBottom = lineTop + lineHeight <= scrollTop + containerHeight - bottomOffset;

    // ВАЖНО: Если пользователь прокрутил дальше текущей активной строки, не пытаемся прокрутить обратно
    // Это предотвращает конфликт и зацикливание анимации
    const userScrolledAhead = scrollTop > desiredScrollTop + 50; // 50px допуск

    if (userScrolledAhead) {
      if (timeSinceUserScroll < USER_SCROLL_RETURN_DELAY) {
        debugLog('📍 User ahead (grace period), skipping auto-scroll');
        return;
      }
      debugLog('📍 Grace period elapsed, auto-scrolling back to active line');
    }

    // Если строка не в правильной позиции или обрезана - скроллим
    if (!isInCorrectPosition || !isFullyVisibleBottom) {
      // Используем плавный скролл с разной длительностью для iOS и десктопа
      smoothScrollTo(container, desiredScrollTop, isIOSDevice ? 300 : 300);
    }

    return () => {
      // Очищаем анимацию при размонтировании или изменении зависимостей
      if (smoothScrollAnimationRef.current !== null) {
        cancelAnimationFrame(smoothScrollAnimationRef.current);
        smoothScrollAnimationRef.current = null;
      }
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [currentLineIndexComputed, smoothScrollTo, isIOSDevice]);

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
      // Очищаем анимацию плавного скролла
      if (smoothScrollAnimationRef.current !== null) {
        cancelAnimationFrame(smoothScrollAnimationRef.current);
        smoothScrollAnimationRef.current = null;
      }
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      // Сбрасываем флаги при размонтировании
      hasLongPressTimerRef.current = false;
      isLongPressRef.current = false;
      wasRewindingRef.current = false;
      pressStartTimeRef.current = null;
      userScrolledToEndRef.current = false;
    };
  }, []);

  // Переключатель показа/скрытия текста
  const toggleLyrics = useCallback(() => {
    setShowLyrics((prev) => !prev);
  }, []);

  // Переключатель режима перемешивания треков
  const toggleShuffle = useCallback(() => {
    dispatch(playerActions.toggleShuffle());
  }, [dispatch]);

  // Переключатель режима зацикливания треков
  const toggleRepeat = useCallback(() => {
    dispatch(playerActions.toggleRepeat());
  }, [dispatch]);

  // Показываем текст только если есть синхронизированный текст (караоке)
  // НЕ проверяем currentTrack?.content, так как это обычный текст, не караоке
  // ВАЖНО: Проверяем как загруженный syncedLyrics, так и currentTrack.syncedLyrics напрямую
  // Это гарантирует, что кнопка будет активна даже если useEffect еще не загрузил данные (например, после pull/hot reload)
  const hasTextToShow = useMemo(() => {
    // Сначала проверяем загруженный syncedLyrics
    if (syncedLyrics && syncedLyrics.length > 0) {
      return true;
    }

    // Если syncedLyrics еще не загружен, проверяем currentTrack напрямую
    if (currentTrack) {
      const albumIdComputed = albumId;
      // Проверяем localStorage (dev mode) или syncedLyrics из трека
      const storedSync = loadSyncedLyricsFromStorage(albumIdComputed, currentTrack.id, lang);
      const baseSynced = storedSync || currentTrack.syncedLyrics;
      return baseSynced && baseSynced.length > 0;
    }

    return false;
  }, [syncedLyrics, currentTrack, albumId, lang]);

  // Ref для прямого доступа к элементу отображения времени
  const timeDisplayRef = useRef<HTMLDivElement | null>(null);

  // ПОЛНОСТЬЮ ОБХОДИМ REDUX для обновления таймеров!
  // Подписываемся напрямую на audio элемент и обновляем ОДИН текстовый узел
  useEffect(() => {
    const element = timeDisplayRef.current;
    if (!element) return;

    const audioElement = audioController.element;

    // Throttling для оптимизации
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 100; // 100мс = 10 обновлений в секунду

    const updateDisplay = () => {
      const now = Date.now();
      if (now - lastUpdate < UPDATE_INTERVAL) return;
      lastUpdate = now;

      const { currentTime, duration } = audioElement;
      if (!Number.isFinite(duration) || duration <= 0) return;

      // Преобразуем время в целые секунды, чтобы избежать разницы округления
      const totalSeconds = Math.max(0, Math.floor(duration));
      const elapsedSeconds = Math.min(totalSeconds, Math.max(0, Math.floor(currentTime)));
      const remainingSeconds = Math.max(totalSeconds - elapsedSeconds, 0);

      // Вычисляем оба значения на основе одинакового округления
      const currentValue = formatTime(elapsedSeconds);
      const remainingValue = formatTime(remainingSeconds);

      // Создаем DocumentFragment для батчинга DOM операций
      // Это самый низкоуровневый способ гарантировать синхронность
      const fragment = document.createDocumentFragment();

      const currentSpan = document.createElement('span');
      currentSpan.className = 'player__time-current';
      currentSpan.textContent = currentValue;

      const remainingSpan = document.createElement('span');
      remainingSpan.className = 'player__time-remaining';
      remainingSpan.textContent = remainingValue;

      fragment.appendChild(currentSpan);
      fragment.appendChild(remainingSpan);

      // replaceChildren() заменяет ВСЕ дочерние элементы за ОДНУ атомарную операцию
      element.replaceChildren(fragment);
    };

    // Подписываемся на событие timeupdate напрямую
    audioElement.addEventListener('timeupdate', updateDisplay);
    // Также обновляем при загрузке метаданных
    audioElement.addEventListener('loadedmetadata', updateDisplay);
    // И при изменении длительности
    audioElement.addEventListener('durationchange', updateDisplay);

    // Первоначальное обновление
    updateDisplay();

    return () => {
      audioElement.removeEventListener('timeupdate', updateDisplay);
      audioElement.removeEventListener('loadedmetadata', updateDisplay);
      audioElement.removeEventListener('durationchange', updateDisplay);
    };
  }, [formatTime]);

  // Отслеживание активности пользователя (мышь, клавиатура, тач)
  // ВАЖНО: таймер работает только в режиме показа текста И только при воспроизведении
  useEffect(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    // Обработчики для различных типов активности
    const handleActivity = (event: Event) => {
      const eventType = event.type;
      if ((eventType === 'mousemove' || eventType === 'touchmove') && !controlsVisibleRef.current) {
        return;
      }
      resetInactivityTimer();
    };

    // Добавляем обработчики событий только если режим текста включен
    if (showLyrics) {
      container.addEventListener('mousemove', handleActivity, { passive: true });
      container.addEventListener('mousedown', handleActivity, { passive: true });
      if (!isCoarsePointerDevice) {
        container.addEventListener('touchstart', handleActivity, { passive: true });
        container.addEventListener('touchmove', handleActivity, { passive: true });
      }
      document.addEventListener('keydown', handleActivity, { passive: true });

      // Инициализируем таймер только если трек играет
      if (isPlaying) {
        resetInactivityTimer();
      }
    }

    return () => {
      container.removeEventListener('mousemove', handleActivity);
      container.removeEventListener('mousedown', handleActivity);
      if (!isCoarsePointerDevice) {
        container.removeEventListener('touchstart', handleActivity);
        container.removeEventListener('touchmove', handleActivity);
      }
      document.removeEventListener('keydown', handleActivity);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer, showLyrics, isPlaying, isCoarsePointerDevice]);

  // Обработка изменения состояния: показываем контролы при паузе или выходе из режима текста
  useEffect(() => {
    // Если трек поставили на паузу ИЛИ вышли из режима текста — сразу показываем контролы
    if (!showLyrics || !isPlaying) {
      showControls();
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } else if (showLyrics && isPlaying) {
      // Если вошли в режим текста И трек играет — запускаем таймер
      resetInactivityTimer();
    }
  }, [showLyrics, isPlaying, resetInactivityTimer, showControls]);

  useEffect(() => {
    if (!showLyrics) {
      setCurrentLineIndex(null);
    }
  }, [showLyrics]);

  useEffect(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    // Обработчики для различных типов активности
    const handleActivity = (event: Event) => {
      const eventType = event.type;
      if ((eventType === 'mousemove' || eventType === 'touchmove') && !controlsVisibleRef.current) {
        return;
      }
      resetInactivityTimer();
    };

    // Добавляем обработчики событий только если режим текста включен
    if (showLyrics) {
      container.addEventListener('mousemove', handleActivity, { passive: true });
      container.addEventListener('mousedown', handleActivity, { passive: true });
      if (!isCoarsePointerDevice) {
        container.addEventListener('touchstart', handleActivity, { passive: true });
        container.addEventListener('touchmove', handleActivity, { passive: true });
      }
      document.addEventListener('keydown', handleActivity, { passive: true });

      // Инициализируем таймер только если трек играет
      if (isPlaying) {
        resetInactivityTimer();
      }
    }

    return () => {
      container.removeEventListener('mousemove', handleActivity);
      container.removeEventListener('mousedown', handleActivity);
      if (!isCoarsePointerDevice) {
        container.removeEventListener('touchstart', handleActivity);
        container.removeEventListener('touchmove', handleActivity);
      }
      document.removeEventListener('keydown', handleActivity);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer, showLyrics, isPlaying, isCoarsePointerDevice]);

  const coverWrapperClassName = `player__cover-wrapper${showLyrics ? ' player__cover-wrapper--lyrics' : ''}`;
  const coverClassName = `player__cover ${coverAnimationClass}${showLyrics ? ' player__cover--clickable' : ''}`;
  const coverInteractiveProps = useMemo<React.HTMLAttributes<HTMLDivElement>>(() => {
    if (!showLyrics) {
      return {};
    }

    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Скрыть текст',
      onClick: () => {
        toggleLyrics();
        resetInactivityTimer();
      },
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleLyrics();
          resetInactivityTimer();
        }
      },
    };
  }, [showLyrics, toggleLyrics, resetInactivityTimer]);

  return (
    <div
      ref={playerContainerRef}
      className={`player ${showLyrics ? 'player--lyrics-visible' : ''} ${!controlsVisible ? 'player--controls-hidden' : ''}`}
    >
      {/* Обложка альбома и информация о треке */}
      <div className={coverWrapperClassName}>
        <div className={coverClassName.trim()} {...coverInteractiveProps}>
          {memoizedAlbumCover}
        </div>
        <div className="player__track-info">
          <h2>{currentTrack?.title || 'Unknown Track'}</h2>
          <h3>{album.artist || 'Unknown Artist'}</h3>
        </div>
      </div>

      {/* Синхронизированный текст песни (karaoke-style) */}
      {showLyrics && syncedLyrics && syncedLyrics.length > 0 && (
        <div
          className="player__synced-lyrics"
          ref={lyricsContainerRef}
          data-opacity-mode={lyricsOpacityMode}
          data-platform={isIOSDevice ? 'ios' : 'default'}
        >
          {syncedLyrics.map((line: SyncedLyricsLine, index: number) => {
            const isActive = currentLineIndexComputed === index;
            // Вычисляем расстояние от активной строки для градиента размытия
            const distance =
              currentLineIndexComputed !== null ? Math.abs(index - currentLineIndexComputed) : null;

            // Определяем, нужно ли показывать троеточие перед этой строкой и вычисляем прогресс градиента
            // Используем time.current напрямую для гарантированного обновления при клике на слайдер
            const placeholderData = (() => {
              const timeValue = time.current;
              const firstLine = syncedLyrics[0];

              // Перед первой строкой: если первая строка не начинается с 0 и время меньше startTime
              // ВАЖНО: эта проверка должна быть первой и применяться только к первой строке (index === 0)
              if (index === 0 && firstLine.startTime > 0) {
                // Если время меньше startTime первой строки - показываем placeholder перед первой строкой
                // Увеличиваем порог до 1 секунды, чтобы покрыть случаи, когда клик устанавливает небольшое время
                if (timeValue < firstLine.startTime) {
                  // Прогресс от 0 (начало) до 1 (конец промежутка)
                  const normalizedTime = Math.max(0, timeValue); // Не позволяем отрицательным значениям
                  const progress = Math.max(0, Math.min(1, normalizedTime / firstLine.startTime));
                  return { show: true, progress };
                }
                // Если время >= startTime первой строки - не показываем placeholder перед первой строкой
                return { show: false, progress: 0 };
              }

              // Между строками: если у предыдущей строки есть endTime и время между endTime и startTime текущей
              // Увеличиваем погрешность до 0.5 секунды для корректной работы при перемотке и переключении треков
              if (index > 0) {
                const prevLine = syncedLyrics[index - 1];
                if (prevLine.endTime !== undefined) {
                  // ВАЖНО: если endTime предыдущей строки === startTime текущей, промежутка нет - не показываем заглушку
                  if (prevLine.endTime === line.startTime) {
                    return { show: false, progress: 0 };
                  }

                  // Показываем placeholder если время в диапазоне [endTime - 0.5, startTime)
                  if (timeValue >= prevLine.endTime - 0.5 && timeValue < line.startTime) {
                    // Прогресс от 0 (начало промежутка) до 1 (конец промежутка)
                    const intervalDuration = line.startTime - prevLine.endTime;
                    const elapsed = Math.max(0, timeValue - prevLine.endTime);
                    const progress =
                      intervalDuration > 0 ? Math.min(1, elapsed / intervalDuration) : 0;
                    return { show: true, progress };
                  }
                }
              }

              return { show: false, progress: 0 };
            })();

            return (
              <React.Fragment key={`line-fragment-${index}`}>
                {/* Троеточие перед строкой, если нужно */}
                {placeholderData.show && (
                  <div
                    key={`placeholder-${index}`}
                    className="player__synced-lyrics-line player__synced-lyrics-line--placeholder"
                    style={
                      {
                        '--placeholder-progress': placeholderData.progress,
                      } as React.CSSProperties
                    }
                  >
                    <span className="player__lyrics-placeholder-dot" data-dot-index="0">
                      ·
                    </span>
                    <span className="player__lyrics-placeholder-dot" data-dot-index="1">
                      ·
                    </span>
                    <span className="player__lyrics-placeholder-dot" data-dot-index="2">
                      ·
                    </span>
                  </div>
                )}

                {/* Сама строка текста */}
                <div
                  key={index}
                  ref={(el) => {
                    if (el) {
                      lineRefs.current.set(index, el);
                    } else {
                      lineRefs.current.delete(index);
                    }
                  }}
                  className={`player__synced-lyrics-line ${isActive ? 'player__synced-lyrics-line--active' : ''} ${authorshipText && line.text === authorshipText ? 'player__synced-lyrics-line--authorship' : ''}`}
                  data-distance={
                    distance !== null && !isActive ? Math.min(distance, 10) : undefined
                  }
                  onClick={() => {
                    handleLineClick(line.startTime);
                    resetInactivityTimer();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLineClick(line.startTime);
                      resetInactivityTimer();
                    }
                  }}
                  aria-label={`Перемотать к ${line.text}`}
                >
                  {authorshipText && line.text === authorshipText
                    ? `Авторство: ${line.text}`
                    : line.text}
                </div>
              </React.Fragment>
            );
          })}

          {/* Троеточие после последней строки, если нужно */}
          {(() => {
            const timeValue = time.current;
            const lastLine = syncedLyrics[syncedLyrics.length - 1];
            // Увеличиваем погрешность до 0.5 секунды для корректной работы при перемотке и переключении треков
            const showPlaceholderAfter =
              lastLine.endTime !== undefined &&
              timeValue >= lastLine.endTime - 0.5 &&
              timeValue < time.duration;

            if (!showPlaceholderAfter || lastLine.endTime === undefined) return null;

            // Прогресс от 0 (начало промежутка после последней строки) до 1 (конец трека)
            const intervalDuration = time.duration - lastLine.endTime;
            const elapsed = Math.max(0, timeValue - lastLine.endTime);
            const progress = intervalDuration > 0 ? Math.min(1, elapsed / intervalDuration) : 0;

            return (
              <div
                key="placeholder-after"
                className="player__synced-lyrics-line player__synced-lyrics-line--placeholder"
                style={
                  {
                    '--placeholder-progress': progress,
                  } as React.CSSProperties
                }
              >
                <span className="player__lyrics-placeholder-dot" data-dot-index="0">
                  ·
                </span>
                <span className="player__lyrics-placeholder-dot" data-dot-index="1">
                  ·
                </span>
                <span className="player__lyrics-placeholder-dot" data-dot-index="2">
                  ·
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Прогресс воспроизведения: слайдер и время */}
      <div
        className={`player__progress-container ${!controlsVisible ? 'player__progress-container--hidden' : ''}`}
      >
        <div className="player__progress-bar">
          <input
            ref={progressInputRef}
            type="range"
            value={progress}
            min="0"
            max="100"
            onChange={handleProgressChange}
            onInput={handleProgressChange} // onInput срабатывает раньше onChange и мгновенно
            onMouseUp={handleSeekEnd} // для десктопа
            onTouchEnd={handleSeekEnd} // для мобильных
            onMouseDown={resetInactivityTimer} // Сбрасываем таймер при начале взаимодействия
            onTouchStart={resetInactivityTimer} // Сбрасываем таймер при начале взаимодействия
          />
        </div>
        {/* Время: текущее и оставшееся */}
        {/* ВАЖНО: используем один контейнер для обоих значений */}
        {/* Обновление через innerHTML гарантирует абсолютную атомарность - оба значения обновляются за одну операцию */}
        <div ref={timeDisplayRef} className="player__time-container"></div>
      </div>

      {/* Кнопки управления: предыдущий трек, play/pause, следующий трек */}
      <div className={`player__controls ${!controlsVisible ? 'player__controls--hidden' : ''}`}>
        <button
          className="icon-controller-fast-backward"
          onMouseDown={(e) => {
            e.preventDefault(); // Предотвращаем focus и клик при удержании
            handleRewindStart('backward');
            resetInactivityTimer();
          }}
          onMouseUp={() => handleRewindEnd('backward', prevTrack)}
          onMouseLeave={() => handleRewindEnd('backward', prevTrack)}
          onTouchStart={(e) => {
            e.preventDefault(); // Предотвращаем клик при touch
            handleRewindStart('backward');
            resetInactivityTimer();
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
        />
        <button
          className={isPlaying ? 'icon-controller-pause' : 'icon-controller-play'}
          onClick={() => {
            togglePlayPause();
            resetInactivityTimer();
          }}
        />
        <button
          className="icon-controller-fast-forward"
          onMouseDown={(e) => {
            e.preventDefault(); // Предотвращаем focus и клик при удержании
            handleRewindStart('forward');
            resetInactivityTimer();
          }}
          onMouseUp={() => handleRewindEnd('forward', nextTrack)}
          onMouseLeave={() => handleRewindEnd('forward', nextTrack)}
          onTouchStart={(e) => {
            e.preventDefault(); // Предотвращаем клик при touch
            handleRewindStart('forward');
            resetInactivityTimer();
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
        />
      </div>

      {/* Контрол громкости (скрыт на мобильных устройствах) */}
      <div
        className={`player__volume-control ${!controlsVisible ? 'player__volume-control--hidden' : ''}`}
      >
        <span className="icon-volume-mute"></span>
        <input type="range" value={volume} min="0" max="100" onChange={handleVolumeChange} />
        <span className="icon-volume-hight"></span>
      </div>

      {/* Контрол переключения текста и режимов воспроизведения */}
      <div
        className={`player__secondary-controls ${!controlsVisible ? 'player__secondary-controls--hidden' : ''}`}
      >
        {/* Кнопка перемешивания треков */}
        <button
          type="button"
          onClick={() => {
            toggleShuffle();
            resetInactivityTimer();
          }}
          className={`player__control-button ${shuffle ? 'player__control-button--active' : ''}`}
          aria-label={shuffle ? 'Выключить перемешивание' : 'Включить перемешивание'}
        >
          <span className="player__control-button-icon icon-shuffle1"></span>
        </button>

        {/* Кнопка зацикливания треков (три состояния: none → all → one → none) */}
        <button
          type="button"
          onClick={() => {
            toggleRepeat();
            resetInactivityTimer();
          }}
          className={`player__control-button ${repeat !== 'none' ? 'player__control-button--active' : ''}`}
          aria-label={
            repeat === 'none'
              ? 'Включить зацикливание плейлиста'
              : repeat === 'all'
                ? 'Зациклить один трек'
                : 'Выключить зацикливание'
          }
        >
          {repeat === 'one' ? (
            <span className="player__control-button-icon icon-repeat_one"></span>
          ) : (
            <span className="player__control-button-icon icon-loop"></span>
          )}
        </button>

        {/* Кнопка переключения текста */}
        <button
          type="button"
          onClick={() => {
            toggleLyrics();
            resetInactivityTimer();
          }}
          disabled={!hasTextToShow}
          className={`player__lyrics-toggle icon-quote ${showLyrics ? 'player__lyrics-toggle--active' : ''}`}
          aria-label={showLyrics ? 'Скрыть текст' : 'Показать текст'}
          aria-disabled={!hasTextToShow}
        />
      </div>

      {/* Невидимый контейнер для прикрепления audio элемента к DOM */}
      <div ref={audioContainerRef} style={{ display: 'none' }} />
    </div>
  );
}
