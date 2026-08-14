-- Adiciona a coluna de cor do cabelo do avatar
ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS avatar_hair_color text DEFAULT 'preto';
