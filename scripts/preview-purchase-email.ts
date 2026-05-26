#!/usr/bin/env tsx
/**
 * Renders both the legacy ecommerce-style purchase email and the new
 * minimal / atmospheric variant to standalone HTML files so they can be
 * inspected side-by-side (or fed to a screenshot tool).
 *
 * Usage:
 *   npx tsx scripts/preview-purchase-email.ts
 *
 * Output:
 *   dist/email-previews/purchase-email.before.html  (legacy receipt look)
 *   dist/email-previews/purchase-email.after.html   (new dark / gold)
 *   dist/email-previews/purchase-email.after-ru.html
 *   dist/email-previews/purchase-email.after-no-cover.html
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildPurchaseEmailContent } from '../netlify/functions/lib/purchase-email-template';

const LOCAL_COVER_PATH = path.resolve(__dirname, '..', 'src', 'images', 'album-placeholder.png');
const SAMPLE = {
  customerName: 'Алексей',
  albumName: 'Rubber Soul',
  artistName: 'The Beatles',
  orderId: 'abcdef1234567890',
  albumUrl: 'https://smolyanoechuchelko.ru/en/albums/rubber-soul',
  /**
   * In production this is a Supabase Storage URL. For an offline preview we use a
   * file:// URL so headless Chrome can render the cover without network access.
   * Override with `PREVIEW_COVER_URL=https://...` env var when sharing the HTML.
   */
  albumCoverUrl: process.env.PREVIEW_COVER_URL || `file://${LOCAL_COVER_PATH}`,
  siteName: 'Smolyanoe Chuchelko',
};

/**
 * Snapshot of the *previous* template before the redesign, kept here only so the
 * preview script can render an apples-to-apples "before" file. It is intentionally
 * unused at runtime — production code now lives in purchase-email-template.ts.
 */
function buildLegacyPurchaseEmailHtml(): string {
  const tracks = [
    { trackId: '1', title: 'Drive My Car' },
    { trackId: '2', title: 'Norwegian Wood (This Bird Has Flown)' },
    { trackId: '3', title: 'You Won\u2019t See Me' },
    { trackId: '4', title: 'Nowhere Man' },
  ];
  const tracksList = tracks
    .map(
      (track, index) => `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 0; color: #333;">${index + 1}.</td>
          <td style="padding: 12px 0; color: #333;">${track.title}</td>
          <td style="padding: 12px 0; text-align: right;">
            <a href="https://smolyanoechuchelko.ru/api/download?token=DEMO&track=${track.trackId}"
               style="color: #4CAF50; text-decoration: none; font-weight: 500;">
              Download
            </a>
          </td>
        </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank you for your purchase!</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background-color:#f5f5f5;">
  <div style="background-color:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color:#4CAF50;margin-top:0;">Thank you for your purchase! \u2705</h1>
    <p>Hello, ${SAMPLE.customerName}!</p>
    <p>Your order <strong>#${SAMPLE.orderId.slice(0, 8)}</strong> has been paid successfully.</p>
    <h2 style="color:#333;margin-top:30px;margin-bottom:15px;">
      ${SAMPLE.artistName} \u2014 ${SAMPLE.albumName}
    </h2>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr style="border-bottom:2px solid #4CAF50;">
          <th style="text-align:left;padding:10px 0;color:#666;font-weight:600;width:40px;">#</th>
          <th style="text-align:left;padding:10px 0;color:#666;font-weight:600;">Track</th>
          <th style="text-align:right;padding:10px 0;color:#666;font-weight:600;">Download</th>
        </tr>
      </thead>
      <tbody>
        ${tracksList}
      </tbody>
    </table>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:30px 0;">
    <p style="color:#666;font-size:14px;margin:0;">
      If you have any questions, please contact us:
      <a href="mailto:feedback@smolyanoechuchelko.ru" style="color:#4CAF50;">feedback@smolyanoechuchelko.ru</a>
    </p>
  </div>
</body>
</html>`.trim();
}

function writeHtml(filename: string, html: string): void {
  const outDir = path.resolve(__dirname, '..', 'dist', 'email-previews');
  mkdirSync(outDir, { recursive: true });
  const fullPath = path.join(outDir, filename);
  writeFileSync(fullPath, html, 'utf-8');
  console.log(`✓ wrote ${path.relative(process.cwd(), fullPath)}`);
}

function main(): void {
  writeHtml('purchase-email.before.html', buildLegacyPurchaseEmailHtml());

  const after = buildPurchaseEmailContent({
    locale: 'en',
    customerName: 'Alex',
    albumName: SAMPLE.albumName,
    artistName: SAMPLE.artistName,
    orderId: SAMPLE.orderId,
    albumUrl: SAMPLE.albumUrl,
    albumCoverUrl: SAMPLE.albumCoverUrl,
    siteName: SAMPLE.siteName,
  });
  writeHtml('purchase-email.after.html', after.html);

  const afterRu = buildPurchaseEmailContent({
    locale: 'ru',
    customerName: SAMPLE.customerName,
    albumName: SAMPLE.albumName,
    artistName: SAMPLE.artistName,
    orderId: SAMPLE.orderId,
    albumUrl: 'https://smolyanoechuchelko.ru/albums/rubber-soul',
    albumCoverUrl: SAMPLE.albumCoverUrl,
    siteName: SAMPLE.siteName,
  });
  writeHtml('purchase-email.after-ru.html', afterRu.html);

  const afterNoCover = buildPurchaseEmailContent({
    locale: 'en',
    customerName: 'Alex',
    albumName: SAMPLE.albumName,
    artistName: SAMPLE.artistName,
    orderId: SAMPLE.orderId,
    albumUrl: SAMPLE.albumUrl,
    albumCoverUrl: null,
    siteName: SAMPLE.siteName,
  });
  writeHtml('purchase-email.after-no-cover.html', afterNoCover.html);

  console.log('\nOpen these files in a browser to compare side-by-side.');
}

main();
