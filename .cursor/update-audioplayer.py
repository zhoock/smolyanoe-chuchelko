#!/usr/bin/env python3
import re

file_path = 'src/features/player/ui/AudioPlayer/AudioPlayer.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Добавить состояния после plainLyricsContent
content = content.replace(
    '  const [plainLyricsContent, setPlainLyricsContent] = useState<string | null>(null); // обычный текст (не синхронизированный)\n  const globalShowLyrics = useAppSelector(playerSelectors.selectShowLyrics);',
    '  const [plainLyricsContent, setPlainLyricsContent] = useState<string | null>(null); // обычный текст (не синхронизированный)\n  const [isLoadingSyncedLyrics, setIsLoadingSyncedLyrics] = useState<boolean>(false);\n  const [hasSyncedLyricsAvailable, setHasSyncedLyricsAvailable] = useState<boolean>(false);\n  const globalShowLyrics = useAppSelector(playerSelectors.selectShowLyrics);'
)

# 2. Обновить вызов useLyricsContent
content = content.replace(
    '    setPlainLyricsContent,\n    setAuthorshipText,\n    setCurrentLineIndex,\n  });',
    '    setPlainLyricsContent,\n    setAuthorshipText,\n    setCurrentLineIndex,\n    setIsLoadingSyncedLyrics,\n    setHasSyncedLyricsAvailable,\n  });'
)

# 3. Удалить старый useMemo для hasSyncedLyricsAvailable
content = re.sub(
    r'  const hasSyncedLyricsAvailable = useMemo\(\(\) => \{[^}]+\}, \[syncedLyrics, currentTrack\]\);\n\n',
    '',
    content,
    flags=re.DOTALL
)

# 4. Обновить логику рендеринга
content = content.replace(
    '  const shouldRenderSyncedLyrics = showLyrics && !!(syncedLyrics && syncedLyrics.length > 0);\n  const shouldRenderPlainLyrics = showLyrics && !shouldRenderSyncedLyrics && !!plainLyricsContent;',
    '''  const shouldRenderSyncedLyrics = showLyrics && !!(syncedLyrics && syncedLyrics.length > 0);
  // Показываем обычный текст только если нет синхронизированной версии (даже если она еще загружается)
  // Если синхронизированная версия существует, показываем скелетон вместо обычного текста
  const shouldRenderPlainLyrics =
    showLyrics &&
    !shouldRenderSyncedLyrics &&
    !hasSyncedLyricsAvailable &&
    !isLoadingSyncedLyrics &&
    !!plainLyricsContent;
  const shouldRenderSkeleton =
    showLyrics &&
    !shouldRenderSyncedLyrics &&
    (hasSyncedLyricsAvailable || isLoadingSyncedLyrics);'''
)

# 5. Обновить условие в JSX
content = content.replace(
    '{showLyrics && (shouldRenderSyncedLyrics || shouldRenderPlainLyrics) && (',
    '{showLyrics && (shouldRenderSyncedLyrics || shouldRenderPlainLyrics || shouldRenderSkeleton) && ('
)

# 6. Добавить скелетон в JSX
content = content.replace(
    '          ) : (\n            <div className="player__plain-lyrics">{plainLyricsContent ?? \'\'}</div>\n          )}',
    '''          ) : shouldRenderSkeleton ? (
            <div className="player__lyrics-skeleton">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="player__lyrics-skeleton-line"
                  style={{
                    width: `${Math.random() * 30 + 60}%`,
                    animationDelay: `${index * 0.1}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="player__plain-lyrics">{plainLyricsContent ?? ''}</div>
          )}'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('AudioPlayer.tsx updated successfully')

