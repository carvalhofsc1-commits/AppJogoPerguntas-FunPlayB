-- Adiciona coluna para rastrear quando novas perguntas foram adicionadas ao tema
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS last_question_added_at TIMESTAMPTZ;
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS new_questions_count INTEGER DEFAULT 0;

-- Cria uma função que atualiza o tema quando uma pergunta é aprovada
CREATE OR REPLACE FUNCTION update_theme_on_question_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma pergunta muda de status para 'aprovada', atualiza o tema
  IF NEW.status = 'aprovada' AND (OLD.status IS NULL OR OLD.status != 'aprovada') THEN
    UPDATE public.themes
    SET 
      last_question_added_at = NOW(),
      new_questions_count = (
        SELECT COUNT(*) FROM public.questions
        WHERE theme_id = NEW.theme_id
          AND status = 'aprovada'
          AND updated_at >= COALESCE(
            (SELECT last_question_added_at FROM public.themes WHERE id = NEW.theme_id),
            NOW() - INTERVAL '1 year'
          ) - INTERVAL '1 second'
      )
    WHERE id = NEW.theme_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger se já existir (idempotente)
DROP TRIGGER IF EXISTS trg_question_approved ON public.questions;

-- Cria o trigger
CREATE TRIGGER trg_question_approved
AFTER INSERT OR UPDATE OF status ON public.questions
FOR EACH ROW
EXECUTE FUNCTION update_theme_on_question_approved();
