/**
 * Утилита для получения длительности аудиофайла из метаданных
 * Использует HTMLAudioElement для загрузки метаданных без загрузки всего файла
 */

/**
 * Получает длительность аудиофайла в минутах
 * @param audioUrl - URL аудиофайла
 * @returns Promise с длительностью в минутах или null, если не удалось загрузить
 */
export async function getAudioDuration(audioUrl: string): Promise<number | null> {
  if (!audioUrl || !audioUrl.trim()) {
    return null;
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata'; // Загружаем только метаданные, не весь файл

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      audio.src = '';
      audio.load();
    };

    const onLoadedMetadata = () => {
      const durationInSeconds = audio.duration;
      if (Number.isFinite(durationInSeconds) && durationInSeconds > 0) {
        // Конвертируем секунды в минуты
        const durationInMinutes = durationInSeconds / 60;
        cleanup();
        resolve(durationInMinutes);
      } else {
        cleanup();
        resolve(null);
      }
    };

    const onError = () => {
      cleanup();
      resolve(null);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);

    // Устанавливаем источник и начинаем загрузку метаданных
    audio.src = audioUrl;
    audio.load();

    // Таймаут на случай, если метаданные не загрузятся
    setTimeout(() => {
      if (audio.readyState < 1) {
        // HAVE_NOTHING - метаданные не загружены
        cleanup();
        resolve(null);
      }
    }, 10000); // 10 секунд таймаут
  });
}
