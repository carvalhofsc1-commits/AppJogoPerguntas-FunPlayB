ALTER TABLE public.game_settings
  ADD COLUMN IF NOT EXISTS ai_import_prompt text;
