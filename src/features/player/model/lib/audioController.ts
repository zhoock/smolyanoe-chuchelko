// src/features/player/model/lib/audioController.ts
/**
 * Контроллер для управления HTMLAudioElement.
 * Это единая точка доступа к аудио-элементу во всём приложении.
 * Используется паттерн Singleton: создаётся один экземпляр на всё приложение.
 */
class AudioController {
  private audio: HTMLAudioElement;
  private currentSrc: string = ''; // Отслеживаем установленный источник

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
   * Нормализует URL для сравнения (извлекает путь без query params)
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';
    try {
      const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : '');
      return urlObj.pathname;
    } catch {
      return url.split('?')[0].split('#')[0];
    }
  }

  /**
   * Устанавливает источник аудио (URL трека) и загружает его.
   * Предотвращает повторную загрузку того же файла.
   * @param src - путь к аудиофайлу
   * @param autoplay - автоматически запускать воспроизведение
   */
  setSource(src: string | undefined, autoplay: boolean = true) {
    const newSrc = src || '';
    if (!newSrc) return;

    const normalizedNewSrc = this.normalizeUrl(newSrc);
    const normalizedCurrentSrc = this.normalizeUrl(this.currentSrc);
    const normalizedAudioSrc = this.normalizeUrl(this.audio.src || '');

    // Проверяем, не установлен ли уже тот же источник
    // Сравниваем и с currentSrc, и с audio.src (на случай если они не синхронизированы)
    if (
      normalizedNewSrc &&
      ((normalizedCurrentSrc && normalizedCurrentSrc === normalizedNewSrc) ||
        (normalizedAudioSrc && normalizedAudioSrc === normalizedNewSrc))
    ) {
      // Источник уже установлен, только управляем воспроизведением
      if (!autoplay) {
        this.audio.pause();
      }
      return;
    }

    // Устанавливаем новый источник
    this.currentSrc = newSrc;
    this.audio.src = newSrc;
    this.audio.load();

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
