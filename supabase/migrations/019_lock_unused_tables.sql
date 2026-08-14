-- ============================================================
-- Migration 019 — Passo 1 (parte 1/3) da correção de segurança:
-- trava tabelas sem NENHUM uso hoje no app (feature "Grupos" está
-- com a rota /groups comentada em App.tsx, então nada em produção
-- depende de acesso via anon a estas 4 tabelas).
--
-- Risco desta migration: praticamente zero — nenhuma chamada em
-- src/ toca game_groups ou game_group_members; group_sessions e
-- invites só são usadas por Groups.tsx, que não é alcançável pela
-- navegação atual do app.
--
-- Escopo do que falta (não incluído aqui, de propósito):
--   - pin_recovery: será travada junto com o Passo 4 (desativação
--     do fluxo "esqueci meu PIN"), para não quebrar a etapa de
--     solicitação antes da UI ser ajustada.
--   - players (coluna pin): será travada junto com o Passo 2
--     (Edge Function de login), pois o login de hoje lê essa
--     coluna direto do cliente — travar antes quebraria o login.
--   - questions / themes / game_settings / game_sessions /
--     answered_questions / online_presence / release_notes /
--     app_policies: mantidas como estão por ora. Fechar essas por
--     completo (incluindo o problema de "qualquer um pode virar
--     admin") exige um mecanismo real de identidade no servidor
--     (JWT assinado após o login ou Supabase Auth) — registrado
--     como item de segurança nº 5, tratado como projeto à parte.
-- ============================================================

DROP POLICY IF EXISTS "groups_all" ON public.game_groups;
CREATE POLICY "groups_deny_all" ON public.game_groups FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "group_members_all" ON public.game_group_members;
CREATE POLICY "group_members_deny_all" ON public.game_group_members FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "group_sessions_all" ON public.group_sessions;
CREATE POLICY "group_sessions_deny_all" ON public.group_sessions FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "invites_all" ON public.invites;
CREATE POLICY "invites_deny_all" ON public.invites FOR ALL USING (false) WITH CHECK (false);
