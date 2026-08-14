-- Adiciona colunas ausentes na tabela game_sessions
-- Sem estas colunas, o INSERT do jogo falha silenciosamente e as sessões não são salvas

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS skips_used    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elim_used     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS help_ext_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hints_used    integer DEFAULT 0;

-- Sincroniza skips_used com skips para registros existentes que usaram o campo antigo
UPDATE public.game_sessions
SET skips_used = skips
WHERE skips_used = 0 AND skips > 0;
