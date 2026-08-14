-- ============================================================
-- FunPlayB — Schema Completo v2
-- Execute TODO este arquivo no SQL Editor do Supabase.
-- NÃO usa auth.uid() nem auth.users — sistema de auth totalmente customizado.
-- ============================================================

-- ── Remover tabelas antigas se existirem ────────────────────
DROP TABLE IF EXISTS public.pack_questions CASCADE;
DROP TABLE IF EXISTS public.question_packs CASCADE;
DROP TABLE IF EXISTS public.game_sessions CASCADE;

-- ============================================================
-- 1. JOGADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname        text UNIQUE NOT NULL,
  email           text UNIQUE NOT NULL,
  phone           text,
  pin             text NOT NULL,          -- 4 dígitos numéricos, texto simples
  category        text NOT NULL DEFAULT 'jogador', -- 'jogador' | 'admin'
  admin_initials  text,                   -- iniciais do admin para identificar perguntas nativas
  avatar_url      text,
  email_verified  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  last_seen_at    timestamptz
);

-- ── RLS: tabela aberta via anon key (segurança no app) ──────
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_all" ON public.players FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. RECUPERAÇÃO DE PIN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pin_recovery (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  token      text NOT NULL,               -- 6 dígitos numéricos
  expires_at timestamptz NOT NULL,
  used       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pin_recovery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pin_recovery_all" ON public.pin_recovery FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. TEMAS DAS PERGUNTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.themes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.players(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_all" ON public.themes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. PERGUNTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id       uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  statement      text NOT NULL,
  option_a       text NOT NULL,
  option_b       text NOT NULL,
  option_c       text NOT NULL,
  option_d       text NOT NULL,
  correct_answer char(1) NOT NULL CHECK (correct_answer IN ('a','b','c','d')),
  difficulty     text NOT NULL DEFAULT 'medio' CHECK (difficulty IN ('facil','medio','dificil')),
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  reference      text,
  question_number SERIAL,
  is_native      boolean DEFAULT false,   -- true = criada/importada pelo admin
  created_by     uuid REFERENCES public.players(id),
  approved_by    uuid REFERENCES public.players(id),
  images         jsonb DEFAULT '[]',      -- array de URLs no Supabase Storage
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_theme   ON public.questions (theme_id);
CREATE INDEX IF NOT EXISTS idx_questions_status  ON public.questions (status);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions (difficulty);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_all" ON public.questions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. CONTROLE DE PERGUNTAS RESPONDIDAS (modo solo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.answered_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answered_at timestamptz DEFAULT now(),
  UNIQUE (player_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answered_player ON public.answered_questions (player_id);

ALTER TABLE public.answered_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answered_all" ON public.answered_questions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. CONFIGURAÇÕES DO JOGO (por jogador)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id            uuid UNIQUE REFERENCES public.players(id) ON DELETE CASCADE,
  allow_skip           boolean DEFAULT true,
  max_skips            integer DEFAULT 3,       -- -1 = ilimitado
  max_errors           integer DEFAULT 0,       -- 0 = errou encerra, N = permite N erros
  allow_help_external  boolean DEFAULT true,
  max_help_external    integer DEFAULT 1,
  allow_eliminate      boolean DEFAULT true,
  max_eliminate        integer DEFAULT 1,
  allow_image_hint     boolean DEFAULT true,
  max_image_hint       integer DEFAULT 1,
  timer_seconds        integer DEFAULT 60,
  warning_seconds      integer DEFAULT 20,
  warning_overlap      boolean DEFAULT false,
  end_on_timeout       boolean DEFAULT true,
  max_timeouts         integer DEFAULT 1,
  questions_per_round  integer DEFAULT 10,
  sort_mode            text DEFAULT 'gradativo',
  qty_facil            integer DEFAULT 3,
  qty_medio            integer DEFAULT 5,
  qty_dificil          integer DEFAULT 2,
  pts_facil            integer DEFAULT 5,
  pts_medio            integer DEFAULT 10,
  pts_dificil          integer DEFAULT 22,
  allow_vibration      boolean DEFAULT true,
  sounds               jsonb DEFAULT '{}',
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_settings_all" ON public.game_settings FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 7. PRESENÇA ONLINE (heartbeat a cada 30s)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.online_presence (
  player_id  uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  nickname   text NOT NULL,
  last_ping  timestamptz DEFAULT now()
);

ALTER TABLE public.online_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence_all" ON public.online_presence FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 8. HISTÓRICO DE SESSÕES (solo e grupo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid REFERENCES public.players(id),
  score           integer DEFAULT 0,
  total_questions integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  errors          integer DEFAULT 0,
  skips           integer DEFAULT 0,
  duration_secs   integer DEFAULT 0,
  themes_played   jsonb DEFAULT '[]',    -- array de theme_ids
  mode            text DEFAULT 'solo',   -- 'solo' | 'grupo'
  played_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON public.game_sessions (player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_played ON public.game_sessions (played_at DESC);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_all" ON public.game_sessions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. GRUPOS DE JOGO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,              -- padrão: "Grupo 1", "Grupo 2"...
  created_by uuid REFERENCES public.players(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.game_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_all" ON public.game_groups FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 10. MEMBROS DOS GRUPOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_group_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid NOT NULL REFERENCES public.game_groups(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  score     integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (group_id, player_id)
);

ALTER TABLE public.game_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_members_all" ON public.game_group_members FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 11. HISTÓRICO DE PARTIDAS EM GRUPO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid REFERENCES public.game_groups(id),
  group_name      text NOT NULL,
  themes_played   jsonb DEFAULT '[]',
  total_questions integer DEFAULT 0,
  member_scores   jsonb DEFAULT '[]',   -- [{player_id, nickname, score}]
  winner_group    text,                 -- nome do grupo vencedor
  played_at       timestamptz DEFAULT now()
);

ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_sessions_all" ON public.group_sessions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 12. CONVITES ENTRE JOGADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  to_player   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status      text DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','recusado')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites_all" ON public.invites FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 13. INSERIR ADMIN PADRÃO (ajuste o pin e email conforme desejar)
-- ============================================================
INSERT INTO public.players (nickname, email, phone, pin, category, admin_initials, email_verified)
VALUES ('Admin', 'carvalhofsc1@gmail.com', '', '1234', 'admin', 'ADM', true)
ON CONFLICT (nickname) DO NOTHING;
