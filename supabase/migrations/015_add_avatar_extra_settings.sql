-- Adiciona as colunas extras de personalização do avatar (óculos, barba e cor dos olhos)
ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS avatar_glasses integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar_beard integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar_eye_color text DEFAULT '#1C0D00';
