// src/features/player/model/lib/audioController.ts
/**
 * Контроллер для управления HTMLAudioElement.
 * Это единая точка доступа к аудио-элементу во всём приложении.
 * Используется паттерн Singleton: создаётся один экземпляр на всё приложение.
 */
class AudioController {
  private audio: HTMLAudioElement;

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
   * Устанавливает источник аудио (URL трека) и загружает его.
   * @param src - путь к аудиофайлу
   */
  setSource(src: string | undefined, autoplay: boolean = true) {
    this.audio.src = src || '';
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
