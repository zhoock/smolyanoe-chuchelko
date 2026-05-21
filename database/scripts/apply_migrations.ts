/**
 * @deprecated Use `npm run migrate` (scripts/migrate-database.ts) instead.
 *
 * This file is kept as a thin wrapper for older docs/commands.
 * The main migrator loads `.env`, tracks schema_migrations, and applies all SQL files.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  readFileSync(filePath, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      const match = trimmedLine.match(/^([^#=]+)=(.*)$/);
      if (!match) return;

      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

const projectRoot = join(__dirname, '..', '..');
loadEnvFile(join(projectRoot, '.env'));
loadEnvFile(join(projectRoot, '.env.local'));

console.warn('⚠️  database/scripts/apply_migrations.ts is deprecated.');
console.warn('   Running the main migrator: npm run migrate\n');

import('../../scripts/migrate-database.ts').catch((error) => {
  console.error('❌ Failed to run migrations:', error);
  process.exit(1);
});
