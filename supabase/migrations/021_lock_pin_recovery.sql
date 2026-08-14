-- ============================================================
-- Migration 021 — Passo 4 da correção de segurança: trava a
-- tabela pin_recovery.
--
-- Contexto: o fluxo "esqueci meu PIN" (src/pages/RecoverPin.tsx)
-- foi substituído por uma mensagem estática ("em manutenção,
-- contate o administrador") — o app não faz mais nenhuma leitura
-- ou escrita em pin_recovery. Antes disso, essa tabela também
-- estava com RLS aberta (USING (true)), permitindo que qualquer
-- pessoa lesse o token de recuperação de qualquer jogador direto
-- pela API, sem precisar nem do e-mail.
--
-- Risco desta migration: zero — nenhuma chamada em src/ toca mais
-- pin_recovery (confirmado por busca no código antes de escrever
-- esta migration).
-- ============================================================

DROP POLICY IF EXISTS "pin_recovery_all" ON public.pin_recovery;
CREATE POLICY "pin_recovery_deny_all" ON public.pin_recovery FOR ALL USING (false) WITH CHECK (false);
