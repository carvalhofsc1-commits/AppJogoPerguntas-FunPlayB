-- ============================================================
-- Migration 026 — Nickname único ignorando maiúsculas/minúsculas.
--
-- Hoje o UNIQUE(nickname) da tabela players é case-sensitive, então
-- "Fernando" e "fernando" poderiam coexistir como contas diferentes
-- — o que deixaria o login case-insensitive (migration 025) ambíguo
-- entre as duas. Confirmado por consulta que não há colisão hoje.
--
-- 1) Cria um índice único sobre lower(nickname), impedindo esse tipo
--    de colisão a partir de agora (o UNIQUE(nickname) original
--    continua existindo, sem problema — fica redundante mas
--    inofensivo).
-- 2) Cria nickname_available(), para a tela de cadastro checar
--    disponibilidade da mesma forma case-insensitive (hoje o
--    Register.tsx faz um select exato, que ficaria inconsistente
--    com essa regra nova).
-- ============================================================

create unique index if not exists players_nickname_ci_unique
  on public.players (lower(nickname));

create or replace function public.nickname_available(p_nickname text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.players where lower(nickname) = lower(p_nickname)
  );
$$;

revoke all on function public.nickname_available(text) from public;
grant execute on function public.nickname_available(text) to anon, authenticated;
