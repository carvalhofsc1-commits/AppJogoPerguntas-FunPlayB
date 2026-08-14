-- ============================================================
-- Migration 004 — Sincroniza game_settings com o código
-- FunPlay Bíblia | 2026-05-04
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- ============================================================

ALTER TABLE public.game_settings
  ADD COLUMN IF NOT EXISTS allow_vibration  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS end_on_timeout   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_timeouts     integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS warning_seconds  integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS warning_overlap  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pts_facil        integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pts_medio        integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS pts_dificil      integer DEFAULT 22;

-- Notifica o PostgREST para recarregar o cache do schema (opcional, mas recomendado)
NOTIFY pgrst, 'reload schema';
