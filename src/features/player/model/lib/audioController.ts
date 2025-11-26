// src/features/player/model/lib/audioController.ts
/**
 * Контроллер для управления HTMLAudioElement.
 * Это единая точка доступа к аудио-элементу во всём приложении.
 * Используется паттерн Singleton: создаётся один экземпляр на всё приложение.
 */
class AudioController {
  private audio: HTMLAudioElement;
  private pendingSrc: string | null = null; // Отслеживаем источник, который только что установили

  constructor() {
    // Создаём один глобальный audio элемент
    this.audio = new Audio();
    // Предзагружаем только метаданные (не весь файл) для экономии трафика
    this.audio.preload = 'metadata';
  }

  /**
   * Геттер для получения самого audio элемента.
   * Нужен чтобы прикрепить элемент к DOM и слушать его события.
   */
  get element(): HTMLAudioElement {
    return this.audio;
  }

  /**
   * Нормализует URL для сравнения (убирает query params, trailing slash, нормализует протокол)
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';
    try {
      const urlObj = new URL(url, window.location.origin);
      // Убираем query params, hash, trailing slash
      return urlObj.pathname.replace(/\/$/, '');
    } catch {
      // Если не валидный URL, возвращаем как есть
      return url.split('?')[0].split('#')[0].replace(/\/$/, '');
    }
  }

  /**
   * Проверяет, совпадает ли источник с текущим или ожидаемым
   */
  isSourceSet(src: string | undefined): boolean {
    const newSrc = src || '';
    if (!newSrc) return false;

    const normalizedNewSrc = this.normalizeUrl(newSrc);
    const normalizedCurrentSrc = this.normalizeUrl(this.audio.src || '');
    const normalizedPendingSrc = this.pendingSrc ? this.normalizeUrl(this.pendingSrc) : '';

    // Проверяем как текущий источник, так и ожидаемый
    return (
      (!!normalizedCurrentSrc && normalizedCurrentSrc === normalizedNewSrc) ||
      (!!normalizedPendingSrc && normalizedPendingSrc === normalizedNewSrc)
    );
  }

  /**
   * Устанавливает источник аудио (URL трека) и загружает его.
   * Предотвращает повторную загрузку того же файла.
   * @param src - путь к аудиофайлу
   * @param autoplay - автоматически запускать воспроизведение
   */
  setSource(src: string | undefined, autoplay: boolean = true) {
    const newSrc = src || '';
    const currentSrc = this.audio.src || '';

    // Нормализуем URL для корректного сравнения
    const normalizedNewSrc = this.normalizeUrl(newSrc);
    const normalizedCurrentSrc = this.normalizeUrl(currentSrc);
    const normalizedPendingSrc = this.pendingSrc ? this.normalizeUrl(this.pendingSrc) : '';

    // Предотвращаем повторную загрузку того же файла
    // Проверяем как текущий источник, так и ожидаемый (pending)
    if (
      (normalizedCurrentSrc && normalizedCurrentSrc === normalizedNewSrc) ||
      (normalizedPendingSrc && normalizedPendingSrc === normalizedNewSrc)
    ) {
      // Источник уже установлен или устанавливается, только управляем воспроизведением
      if (!autoplay) {
        this.audio.pause();
      }
      return;
    }

    // Устанавливаем флаг ожидаемого источника
    this.pendingSrc = newSrc;
    this.audio.src = newSrc;
    this.audio.load();

    // Сбрасываем флаг после небольшой задержки (когда браузер обновит audio.src)
    setTimeout(() => {
      if (this.pendingSrc === newSrc) {
        this.pendingSrc = null;
      }
    }, 100);

    if (!autoplay) {
      this.audio.pause();
    }
  }

  /**
   * Запускает воспроизведение.
   * Возвращает Promise, который может быть отклонён (например, если браузер блокирует autoplay).
   */
  play() {
    return this.audio.play();
  }

  /**
   * Ставит воспроизведение на паузу.
   */
  pause() {
    this.audio.pause();
  }

  /**
   * Перематывает трек на указанное время (в секундах).
   * @param seconds - время в секундах, на которое нужно перемотать
   */
  setCurrentTime(seconds: number) {
    this.audio.currentTime = seconds;
  }

  /**
   * Устанавливает громкость.
   * @param volume0to100 - громкость от 0 до 100 (переводим в 0-1 для audio.volume)
   */
  setVolume(volume0to100: number) {
    // Ограничиваем значение от 0 до 100 и переводим в диапазон 0-1
    this.audio.volume = Math.max(0, Math.min(100, volume0to100)) / 100;
  }
}

// Экспортируем единственный экземпляр контроллера (Singleton)
export const audioController = new AudioController();
