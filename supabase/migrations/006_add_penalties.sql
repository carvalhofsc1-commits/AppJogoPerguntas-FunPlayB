-- Adiciona as colunas de pontuação e penalidade na tabela game_settings, se não existirem
ALTER TABLE game_settings ADD COLUMN IF NOT EXISTS pts_help_penalty_pct integer DEFAULT 50;
ALTER TABLE game_settings ADD COLUMN IF NOT EXISTS pts_wrong_penalty integer DEFAULT 3;

-- Força o PostgREST a recarregar o cache do schema
NOTIFY pgrst, 'reload schema';
