-- ============================================================
-- FunPlay Bíblia — Schema Supabase
-- Execute no SQL Editor do painel Supabase
-- ============================================================

-- Tabela de pacotes de perguntas (já existente — mantida)
CREATE TABLE IF NOT EXISTS public.question_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  owner_id    uuid REFERENCES auth.users(id),
  is_public   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Tabela de perguntas por pacote (já existente — mantida)
CREATE TABLE IF NOT EXISTS public.pack_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    uuid NOT NULL REFERENCES public.question_packs(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  payload    jsonb NOT NULL
);

-- ============================================================
-- NOVA: Tabela de sessões de jogo (histórico global)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name     text NOT NULL DEFAULT 'Anônimo',
  score           integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  difficulty      text NOT NULL DEFAULT 'Mista',
  played_at       timestamptz NOT NULL DEFAULT now()
);

-- Índice para ordenar por data (dashboard)
CREATE INDEX IF NOT EXISTS idx_game_sessions_played_at
  ON public.game_sessions (played_at DESC);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ver o histórico global (leitura pública)
CREATE POLICY "Leitura pública do histórico"
  ON public.game_sessions FOR SELECT
  USING (true);

-- Qualquer um pode inserir (inclusive visitantes não logados)
CREATE POLICY "Inserção pública de partidas"
  ON public.game_sessions FOR INSERT
  WITH CHECK (true);

-- ── RLS para question_packs ─────────────────────────────────
ALTER TABLE public.question_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura de pacotes públicos"
  ON public.question_packs FOR SELECT
  USING (is_public = true OR auth.uid() = owner_id);

CREATE POLICY "Criação de pacotes autenticados"
  ON public.question_packs FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- ── RLS para pack_questions ─────────────────────────────────
ALTER TABLE public.pack_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura de perguntas de pacotes públicos"
  ON public.pack_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.question_packs p
      WHERE p.id = pack_id AND (p.is_public = true OR auth.uid() = p.owner_id)
    )
  );

CREATE POLICY "Inserção de perguntas autenticadas"
  ON public.pack_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_packs p
      WHERE p.id = pack_id AND auth.uid() = p.owner_id
    )
  );
