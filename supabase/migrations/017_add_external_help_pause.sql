ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS help_external_pause integer DEFAULT 20;
