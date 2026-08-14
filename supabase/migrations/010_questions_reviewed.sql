-- Adiciona controle de revisão às perguntas (admin)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS reviewed         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES public.players(id),
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz;

-- Índice para filtro por revisão
CREATE INDEX IF NOT EXISTS idx_questions_reviewed ON public.questions (reviewed);
