-- Adiciona as colunas de preferências do avatar na tabela de configurações de jogo
ALTER TABLE game_settings
  ADD COLUMN IF NOT EXISTS avatar_mode text DEFAULT 'svg',
  ADD COLUMN IF NOT EXISTS avatar_skin text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS avatar_style integer DEFAULT 1;
