-- Per-locale album cover credits (photographer / designer); не в общем release JSON.
ALTER TABLE albums ADD COLUMN IF NOT EXISTS photographer TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS photographer_url TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS designer TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS designer_url TEXT;
