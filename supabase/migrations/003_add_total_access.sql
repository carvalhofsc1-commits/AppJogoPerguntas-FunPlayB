-- ============================================================
-- Migration 003 — Adiciona contador de acessos ao app
-- FunPlay Bíblia | 2026-04-30
-- ============================================================
-- Execute no SQL Editor do painel Supabase:
-- https://supabase.com/dashboard/project/hbgqgaemtjguscnpjgry/sql
-- ============================================================

-- 1. Adiciona a coluna total_access na tabela players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS total_access integer NOT NULL DEFAULT 0;

-- 2. Inicializa com 1 para usuários que já existem (tiveram pelo menos 1 acesso)
UPDATE public.players
  SET total_access = 1
  WHERE total_access = 0;

-- 3. Confirma a alteração
SELECT 
  id, 
  nickname, 
  total_access, 
  last_seen_at 
FROM public.players 
ORDER BY nickname;
