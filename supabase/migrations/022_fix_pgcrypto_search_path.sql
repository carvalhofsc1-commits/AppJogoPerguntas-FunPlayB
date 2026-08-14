-- ============================================================
-- Migration 022 — Corrige "function crypt(text, text) does not
-- exist" no login.
--
-- Causa: login_player e verify_own_pin (migration 020) declaram
-- `set search_path = public` (boa prática contra search_path
-- hijacking em funções SECURITY DEFINER), mas neste projeto Supabase
-- a extensão pgcrypto está instalada no schema `extensions`, não em
-- `public` (confirmado via pg_extension). Com search_path restrito a
-- `public`, toda chamada de login falhava com erro de função
-- inexistente.
--
-- Correção: qualifica explicitamente extensions.crypt(...) e
-- extensions.gen_salt(...) nas 3 funções que usam pgcrypto (inclui
-- o trigger de hash automático, por consistência/robustez — ele já
-- funcionava por depender do search_path padrão da sessão, mas isso
-- é frágil e fica explícito agora também).
--
-- Nenhum dado é alterado. Apenas recria as funções (CREATE OR REPLACE).
-- ============================================================

create or replace function public.hash_player_pin()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.pin is not null and new.pin !~ '^\$2[aby]\$' then
    new.pin := extensions.crypt(new.pin, extensions.gen_salt('bf'));
  end if;
  return new;
end;
$$;

create or replace function public.login_player(p_identifier text, p_pin text)
returns table (
  result text,
  id uuid,
  nickname text,
  email text,
  category text,
  admin_initials text,
  total_access integer,
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_player public.players%rowtype;
begin
  select * into v_player
  from public.players p
  where p.nickname = p_identifier or lower(p.email) = lower(p_identifier)
  limit 1;

  if v_player.id is null then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text, null::integer, null::text;
    return;
  end if;

  if v_player.pin is null or extensions.crypt(p_pin, v_player.pin) <> v_player.pin then
    return query select 'wrong_pin'::text, null::uuid, null::text, null::text, null::text, null::text, null::integer, null::text;
    return;
  end if;

  if v_player.status = 'suspenso' then
    return query select 'suspended'::text, null::uuid, null::text, null::text, null::text, null::text, null::integer, null::text;
    return;
  end if;

  if v_player.status = 'inativo' then
    return query select 'inactive'::text, null::uuid, null::text, null::text, null::text, null::text, null::integer, null::text;
    return;
  end if;

  update public.players
    set last_seen_at = now(),
        total_access = coalesce(v_player.total_access, 0) + 1
    where id = v_player.id;

  return query
    select 'ok'::text, v_player.id, v_player.nickname, v_player.email, v_player.category,
           v_player.admin_initials, coalesce(v_player.total_access, 0) + 1, v_player.status;
end;
$$;

revoke all on function public.login_player(text, text) from public;
grant execute on function public.login_player(text, text) to anon, authenticated;

create or replace function public.verify_own_pin(p_player_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select pin into v_hash from public.players where id = p_player_id;
  if v_hash is null then
    return false;
  end if;
  return extensions.crypt(p_pin, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_own_pin(uuid, text) from public;
grant execute on function public.verify_own_pin(uuid, text) to anon, authenticated;
