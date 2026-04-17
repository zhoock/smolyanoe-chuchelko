/**
 * URL-хелперы (`getUserImageUrl`, `getImageUrl`, `getUserAudioUrl`) возвращают `null` при ошибке;
 * причина обычно уже залогирована там же (`[BUG]`).
 *
 * Эти функции — граница UI: мы приводим `null` к `undefined` / `''` для типов React и плейлиста,
 * и **дополнительно** логируем, **какой компонент** получил `null`, чтобы не гадать по стеку.
 */

export function optionalMediaSrc(
  url: string | null,
  context: string,
  meta?: Record<string, unknown>
): string | undefined {
  if (url === null) {
    console.error('[BUG] null media URL at UI boundary (use undefined for prop)', {
      context,
      ...meta,
      hint: 'Upstream getUserImageUrl/getImageUrl/getUserAudioUrl should have logged the cause.',
    });
  }
  return url ?? undefined;
}

/** Для пропов со строгим типом `string` (например `TracksProps.src`), где пустая строка — осознанный fallback. */
export function emptyStringMediaSrc(
  url: string | null,
  context: string,
  meta?: Record<string, unknown>
): string {
  if (url === null) {
    console.error('[BUG] null media URL at UI boundary (empty string fallback)', {
      context,
      ...meta,
      hint: 'Upstream getUserImageUrl/getImageUrl/getUserAudioUrl should have logged the cause.',
    });
  }
  return url ?? '';
}
