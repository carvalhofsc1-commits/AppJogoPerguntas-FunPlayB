-- ============================================================
-- Migration 027 — Impede autopromoção a admin e exclusão de
-- usuários sem reautenticação.
--
-- Problema: com RLS aberta (USING true / WITH CHECK true), qualquer
-- pessoa com a anon key consegue, direto pela API REST do Supabase:
--   - fazer `update players set category='admin' where id=<próprio id>`
--   - apagar a conta de QUALQUER jogador (`delete from players
--     where id=<id de outro jogador>`)
-- sem passar pelo app nem por nenhuma verificação.
--
-- Correção:
--   1. Bloqueia UPDATE direto da coluna category (anon/authenticated).
--   2. Bloqueia DELETE direto na tabela players (política nega tudo).
--   3. Cria 3 funções SECURITY DEFINER que fazem essas operações
--      só depois de reverificar o PIN de quem está pedindo:
--        - admin_set_category: promover/rebaixar outro jogador
--          (exige o PIN do PRÓPRIO admin que está pedindo).
--        - admin_delete_player: apagar a conta de outro jogador
--          (exige o PIN do PRÓPRIO admin que está pedindo).
--        - delete_own_account: apagar a própria conta (exige o
--          próprio PIN).
--
-- Fora de escopo por decisão consciente: perguntas/temas
-- (questions/themes) continuam com escrita aberta por enquanto —
-- risco de conteúdo, não de conta de usuário.
-- ============================================================

-- 1) Ninguém muda "category" via update direto
revoke update (category) on public.players from anon, authenticated;

-- 2) Ninguém apaga linhas de players via delete direto
drop policy if exists "players_all" on public.players;
create policy "players_select_all" on public.players for select using (true);
create policy "players_insert_all" on public.players for insert with check (true);
create policy "players_update_all" on public.players for update using (true) with check (true);
create policy "players_delete_none" on public.players for delete using (false);

-- 3a) Promover/rebaixar outro jogador — exige PIN do admin que pede
create or replace function public.admin_set_category(
  p_admin_identifier text,
  p_admin_pin text,
  p_target_player_id uuid,
  p_new_category text,
  p_admin_initials text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.players%rowtype;
begin
  if p_new_category not in ('admin', 'jogador') then
    return 'invalid_category';
  end if;

  select * into v_admin
  from public.players p
  where lower(p.nickname) = lower(p_admin_identifier) or lower(p.email) = lower(p_admin_identifier)
  limit 1;

  if v_admin.id is null or v_admin.category <> 'admin'
     or v_admin.pin is null or extensions.crypt(p_admin_pin, v_admin.pin) <> v_admin.pin then
    return 'unauthorized';
  end if;

  update public.players
    set category = p_new_category,
        admin_initials = coalesce(p_admin_initials, admin_initials)
    where id = p_target_player_id;

  if not found then
    return 'target_not_found';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.admin_set_category(text, text, uuid, text, text) from public;
grant execute on function public.admin_set_category(text, text, uuid, text, text) to anon, authenticated;

-- 3b) Admin apaga a conta de outro jogador — exige o PIN do admin
create or replace function public.admin_delete_player(
  p_admin_identifier text,
  p_admin_pin text,
  p_target_player_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.players%rowtype;
begin
  select * into v_admin
  from public.players p
  where lower(p.nickname) = lower(p_admin_identifier) or lower(p.email) = lower(p_admin_identifier)
  limit 1;

  if v_admin.id is null or v_admin.category <> 'admin'
     or v_admin.pin is null or extensions.crypt(p_admin_pin, v_admin.pin) <> v_admin.pin then
    return 'unauthorized';
  end if;

  delete from public.players where id = p_target_player_id;

  if not found then
    return 'target_not_found';
  end if;

  return 'ok';
exception when foreign_key_violation then
  return 'has_dependencies';
end;
$$;

revoke all on function public.admin_delete_player(text, text, uuid) from public;
grant execute on function public.admin_delete_player(text, text, uuid) to anon, authenticated;

-- 3c) Jogador apaga a própria conta — exige o próprio PIN
create or replace function public.delete_own_account(
  p_player_id uuid,
  p_pin text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select pin into v_hash from public.players where id = p_player_id;
  if v_hash is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    return 'unauthorized';
  end if;

  delete from public.players where id = p_player_id;
  return 'ok';
exception when foreign_key_violation then
  return 'has_dependencies';
end;
$$;

revoke all on function public.delete_own_account(uuid, text) from public;
grant execute on function public.delete_own_account(uuid, text) to anon, authenticated;
