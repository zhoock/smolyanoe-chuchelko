// Скрипт для экспорта данных из localStorage
// Запустите этот код в консоли браузера на странице админки

(function exportLocalStorageData() {
  const data = {
    syncedLyrics: {},
    trackText: {},
    authorship: {},
  };

  // Экспортируем все данные из localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key.startsWith('synced-lyrics-')) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        data.syncedLyrics[key] = value;
      } catch {
        console.warn('Ошибка парсинга для ключа:', key);
      }
    } else if (key.startsWith('track-text-') && !key.includes('authorship')) {
      data.trackText[key] = localStorage.getItem(key);
    } else if (key.includes('authorship')) {
      data.authorship[key] = localStorage.getItem(key);
    }
  }

  // Создаём JSON строку
  const jsonString = JSON.stringify(data, null, 2);

  // Выводим в консоль
  console.log('=== ЭКСПОРТ ДАННЫХ ИЗ LOCALSTORAGE ===');
  console.log(jsonString);
  console.log('=== КОНЕЦ ЭКСПОРТА ===');

  // Создаём blob для скачивания
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'localStorage-export.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('✅ Файл localStorage-export.json скачан!');
  console.log('📝 Теперь запустите: node scripts/update-json-from-export.js');
})();
