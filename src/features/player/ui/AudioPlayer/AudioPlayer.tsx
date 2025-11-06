// src/features/player/ui/AudioPlayer/AudioPlayer.tsx
/**
 * Компонент аудиоплеера.
 * Отвечает только за отображение UI - вся логика воспроизведения находится в Redux и middleware.
 * Компонент получает данные из стейта через селекторы и диспатчит действия для управления плеером.
 */
import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react';
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
  // Состояние режима прозрачности текста: 'normal' | 'user-scrolling' | 'seeking'
  const [lyricsOpacityMode, setLyricsOpacityMode] = useState<
    'normal' | 'user-scrolling' | 'seeking'
  >('normal');
  // Состояние видимости контролов плеера (скрываются после 5 секунд бездействия)
  const [controlsVisible, setControlsVisible] = useState(true);

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
  const prevTrackIdRef = useRef<string | number | null>(null); // предыдущий ID трека для отслеживания смены трека
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // таймер для скрытия контролов после бездействия
  const playerContainerRef = useRef<HTMLDivElement | null>(null); // контейнер плеера для отслеживания активности

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
      // Проверяем, не установлен ли уже правильный класс (чтобы избежать лишних операций с DOM)
      const hasCorrectClass = element.classList.contains(expectedClass);

      if (!hasCorrectClass) {
        // Устанавливаем правильный класс синхронно, чтобы не было анимации
        element.classList.remove('player__cover--playing', 'player__cover--paused');
        element.classList.add(expectedClass);
      }

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
  }, [isPlaying, currentTrackIndex, showLyrics]);

  /**
   * Дополнительная проверка: гарантируем, что класс обложки всегда соответствует текущему состоянию.
   * Это защита от случаев, когда класс не установился по какой-то причине (например, из-за порядка выполнения эффектов).
   * Срабатывает при каждом изменении isPlaying или currentTrackIndex, но с небольшой задержкой,
   * чтобы не конфликтовать с основной логикой анимации.
   */
  useEffect(() => {
    if (!coverRef.current) return;

    // Используем небольшую задержку, чтобы основная логика анимации успела выполниться
    const timeoutId = setTimeout(() => {
      if (!coverRef.current) return;

      const element = coverRef.current;
      const expectedClass = isPlaying ? 'player__cover--playing' : 'player__cover--paused';
      const hasCorrectClass = element.classList.contains(expectedClass);

      // Если класс не соответствует ожидаемому - устанавливаем его принудительно
      if (!hasCorrectClass) {
        element.classList.remove('player__cover--playing', 'player__cover--paused');
        element.classList.add(expectedClass);
        // Обновляем refs для синхронизации
        prevIsPlayingRef.current = isPlaying;
        prevTrackIndexRef.current = currentTrackIndex;
      }
    }, 50); // Небольшая задержка, чтобы основная логика успела выполниться

    return () => clearTimeout(timeoutId);
  }, [isPlaying, currentTrackIndex]);

  /**
   * Устанавливаем правильный класс обложки при переключении режима текста.
   * При переключении showLyrics React пересоздаёт DOM-элемент, поэтому нужно установить класс синхронно.
   */
  useEffect(() => {
    if (!coverRef.current) return;

    const element = coverRef.current;
    const expectedClass = isPlaying ? 'player__cover--playing' : 'player__cover--paused';

    // Устанавливаем класс синхронно, чтобы избежать анимации при пересоздании элемента
    if (!element.classList.contains(expectedClass)) {
      element.classList.remove('player__cover--playing', 'player__cover--paused');
      element.classList.add(expectedClass);
    }
  }, [showLyrics, isPlaying]); // Срабатывает при изменении showLyrics или isPlaying

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

  // Функция для сброса таймера бездействия и показа контролов
  // Объявляем раньше, чтобы использовать в других callback'ах
  // ВАЖНО: таймер работает только в режиме показа текста И только при воспроизведении
  const resetInactivityTimer = useCallback(() => {
    // Показываем контролы при любом взаимодействии
    setControlsVisible(true);

    // Очищаем предыдущий таймер
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Таймер работает только если:
    // 1. Режим показа текста включен (showLyrics === true)
    // 2. Трек играет (isPlaying === true)
    if (showLyrics && isPlaying) {
      // Устанавливаем новый таймер на 5 секунд
      inactivityTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 5000);
    }
  }, [showLyrics, isPlaying]);

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
  // Обработчик клика на строку текста для перемотки трека
  const handleLineClick = useCallback(
    (startTime: number) => {
      if (!time.duration || time.duration <= 0) return;

      const newTime = Math.max(0, Math.min(time.duration, startTime));
      const progress = (newTime / time.duration) * 100;

      dispatch(playerActions.setSeeking(true));
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
        if (isPlaying) {
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
        console.log('🔍 Seeking started, prev mode:', prevMode, '-> seeking');
        return 'seeking';
      });
      // Сбрасываем таймер бездействия при взаимодействии с прогресс-баром
      resetInactivityTimer();
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
    if (isPlaying) {
      dispatch(playerActions.play());
    }
    // Возвращаем режим прозрачности к нормальному сразу после окончания перетаскивания
    // Только если пользователь не прокручивает вручную
    const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
    if (timeSinceUserScroll >= 2000) {
      setLyricsOpacityMode((prevMode) => {
        // Не сбрасываем, если пользователь активно прокручивает
        if (prevMode === 'user-scrolling') {
          console.log('⚠️ handleSeekEnd: keeping user-scrolling mode');
          return prevMode;
        }
        console.log('🔍 handleSeekEnd: resetting to normal');
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
      console.log('🔍 Track changed, resetting opacity mode from:', prevMode);
      return 'normal';
    });

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

    const timeValue = time.current;
    const lines = syncedLyrics;

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
  }, [syncedLyrics, time.current, time.duration]);

  // Синхронизируем вычисленное значение с состоянием для совместимости
  useEffect(() => {
    setCurrentLineIndex(currentLineIndexComputed);
  }, [currentLineIndexComputed]);

  // Отслеживание ручной прокрутки пользователя
  useEffect(() => {
    // Ждем, пока контейнер будет готов (showLyrics может быть false при первом рендере)
    if (!showLyrics) {
      console.log('⚠️ showLyrics is false, skipping scroll listener setup');
      return;
    }

    const container = lyricsContainerRef.current;
    if (!container) {
      console.log('⚠️ Container not found, skipping scroll listener setup');
      return;
    }

    console.log('✅ Scroll listener setup for container:', container);

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let isProgrammaticScroll = false; // Флаг для отслеживания программного скролла

    const handleScroll = () => {
      // Если это программный скролл - игнорируем
      if (isProgrammaticScroll) {
        console.log('⚠️ Ignoring programmatic scroll');
        return;
      }

      console.log('✅ Manual scroll detected!');

      // Помечаем, что пользователь прокручивает вручную
      userScrollTimestampRef.current = Date.now();
      isUserScrollingRef.current = true;
      // Устанавливаем режим прозрачности для ручной прокрутки
      // Используем функциональную форму, чтобы гарантировать установку
      setLyricsOpacityMode((prevMode) => {
        console.log('🔍 User scrolling detected, prev mode:', prevMode, '-> user-scrolling');
        return 'user-scrolling';
      });

      // Сбрасываем предыдущий таймер
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Устанавливаем таймер для возврата к нормальному режиму через 2 секунды после последнего скролла
      scrollTimeout = setTimeout(() => {
        // Проверяем, что режим все еще user-scrolling (не был изменен другим кодом)
        setLyricsOpacityMode((prevMode) => {
          if (prevMode === 'user-scrolling') {
            isUserScrollingRef.current = false;
            console.log('🔍 Scroll timeout, opacity mode reset to: normal');
            return 'normal';
          }
          return prevMode;
        });
      }, 2000);
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
      // Сбрасываем флаг после небольшой задержки (больше, чтобы точно не перехватить событие scroll)
      setTimeout(() => {
        isProgrammaticScroll = false;
      }, 300);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    console.log('✅ Scroll event listener added');

    return () => {
      console.log('🧹 Cleaning up scroll listener');
      container.removeEventListener('scroll', handleScroll);
      container.scrollTo = originalScrollTo;
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [showLyrics]); // Добавляем showLyrics в зависимости, чтобы эффект перезапускался при его изменении

  // Автоскролл к активной строке
  // Не скроллим, если пользователь недавно прокручивал вручную (в течение 2 секунд)
  // ВАЖНО: при резком изменении времени (клик на прогрессбар) нужно прокрутить к нужной позиции
  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container || !syncedLyrics || syncedLyrics.length === 0) return;

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

        // Прокручиваем к началу (к placeholder перед первой строкой)
        container.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
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

    // Если пользователь прокручивал вручную недавно - не вмешиваемся
    if (timeSinceUserScroll < USER_SCROLL_TIMEOUT) {
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

    // Если строка не в правильной позиции или обрезана - скроллим
    if (!isInCorrectPosition || !isFullyVisibleBottom) {
      // Если строка находится слишком высоко (выше желаемой позиции более чем на 20px)
      if (currentLineTopRelative < topOffset - 20) {
        container.scrollTo({
          top: desiredScrollTop,
          behavior: 'smooth',
        });
      }
      // Если строка находится слишком низко или обрезана снизу
      else if (currentLineTopRelative > topOffset + 20 || !isFullyVisibleBottom) {
        container.scrollTo({
          top: desiredScrollTop,
          behavior: 'smooth',
        });
      }
    }
  }, [currentLineIndexComputed]);

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

  // Мемоизируем оба значения времени вместе для синхронного обновления
  // Используем один селектор selectTime для атомарного получения обоих значений
  const timeDisplay = useMemo(() => {
    const current = formatTime(time.current);
    const remaining = formatTime(time.duration - time.current);
    return { current, remaining };
  }, [time.current, time.duration, formatTime]);

  // Ref для прямого доступа к контейнеру времени
  const timeContainerRef = useRef<HTMLDivElement | null>(null);

  // Используем useLayoutEffect для синхронного обновления одного элемента
  // Обновляем оба data-атрибута одновременно, чтобы CSS псевдоэлементы обновились атомарно
  useLayoutEffect(() => {
    if (timeContainerRef.current) {
      // Обновляем оба data-атрибута синхронно в одном блоке
      // Это гарантирует, что браузер обновит оба псевдоэлемента одновременно
      timeContainerRef.current.setAttribute('data-current', timeDisplay.current);
      timeContainerRef.current.setAttribute('data-remaining', timeDisplay.remaining);
    }
  }, [timeDisplay.current, timeDisplay.remaining]);

  // Отслеживание активности пользователя (мышь, клавиатура, тач)
  // ВАЖНО: таймер работает только в режиме показа текста И только при воспроизведении
  useEffect(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    // Обработчики для различных типов активности
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Добавляем обработчики событий только если режим текста включен
    if (showLyrics) {
      container.addEventListener('mousemove', handleActivity, { passive: true });
      container.addEventListener('mousedown', handleActivity, { passive: true });
      container.addEventListener('touchstart', handleActivity, { passive: true });
      container.addEventListener('touchmove', handleActivity, { passive: true });
      document.addEventListener('keydown', handleActivity, { passive: true });

      // Инициализируем таймер только если трек играет
      if (isPlaying) {
        resetInactivityTimer();
      }
    }

    return () => {
      container.removeEventListener('mousemove', handleActivity);
      container.removeEventListener('mousedown', handleActivity);
      container.removeEventListener('touchstart', handleActivity);
      container.removeEventListener('touchmove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer, showLyrics, isPlaying]);

  // Обработка изменения состояния: показываем контролы при паузе или выходе из режима текста
  useEffect(() => {
    // Если трек поставили на паузу ИЛИ вышли из режима текста — сразу показываем контролы
    if (!showLyrics || !isPlaying) {
      setControlsVisible(true);
      // Очищаем таймер, так как скрытие больше не нужно
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } else if (showLyrics && isPlaying) {
      // Если вошли в режим текста И трек играет — запускаем таймер
      resetInactivityTimer();
    }
  }, [showLyrics, isPlaying, resetInactivityTimer]);

  return (
    <div
      ref={playerContainerRef}
      className={`player ${showLyrics ? 'player--lyrics-visible' : ''} ${!controlsVisible ? 'player--controls-hidden' : ''}`}
    >
      {/* Обложка альбома и информация о треке */}
      {showLyrics ? (
        <div className="player__cover-wrapper">
          <div
            ref={coverRef}
            className="player__cover player__cover--clickable"
            onClick={() => {
              toggleLyrics();
              resetInactivityTimer();
            }}
            role="button"
            tabIndex={0}
            aria-label="Скрыть текст"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleLyrics();
                resetInactivityTimer();
              }
            }}
          >
            {memoizedAlbumCover}
          </div>
          <div className="player__track-info">
            <h2>{currentTrack?.title || 'Unknown Track'}</h2>
            <h3>{album.artist || 'Unknown Artist'}</h3>
          </div>
        </div>
      ) : (
        <>
          {/* Обложка альбома с анимацией при play/pause */}
          <div ref={coverRef} className="player__cover">
            {memoizedAlbumCover}
          </div>

          {/* Информация о текущем треке: название и артист */}
          <div className="player__track-info">
            <h2>{currentTrack?.title || 'Unknown Track'}</h2>
            <h3>{album.artist || 'Unknown Artist'}</h3>
          </div>
        </>
      )}

      {/* Синхронизированный текст песни (karaoke-style) */}
      {showLyrics && syncedLyrics && syncedLyrics.length > 0 && (
        <div
          className="player__synced-lyrics"
          ref={lyricsContainerRef}
          data-opacity-mode={lyricsOpacityMode}
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
              <>
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
              </>
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
        {/* Используем один элемент с data-атрибутами и CSS псевдоэлементы для атомарного обновления */}
        <div
          ref={timeContainerRef}
          className="player__time-container"
          data-current={timeDisplay.current}
          data-remaining={timeDisplay.remaining}
        />
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
