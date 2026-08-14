-- ============================================================
-- Migration 020 — Passo 2 da correção de segurança: PIN deixa de
-- ser texto puro.
--
-- O que esta migration faz:
--   1. Habilita a extensão pgcrypto (hash bcrypt).
--   2. Cria um trigger que passa a fazer hash automático de
--      qualquer PIN gravado na tabela players (INSERT ou UPDATE),
--      não importa se veio do cadastro, do Perfil ou da
--      recuperação de PIN — nenhum desses arquivos precisa mudar.
--   3. Converte para hash todos os PINs que hoje estão em texto
--      puro na base (roda uma única vez, é idempotente: se rodar
--      de novo, ignora quem já está em formato de hash bcrypt).
--   4. Cria duas funções SECURITY DEFINER (rodam com privilégio
--      elevado, nunca expõem a coluna pin para quem chama):
--        - login_player(identifier, pin): usada no login.
--        - verify_own_pin(player_id, pin): usada no Perfil para
--          confirmar o PIN atual antes de trocar.
--   5. Revoga a permissão de LEITURA da coluna pin para as roles
--      anon/authenticated — a partir de agora, ninguém consegue
--      mais ler o PIN (nem o hash) direto pela API REST/anon key,
--      só através das funções acima.
--
-- IMPORTANTE — faça backup da tabela players ANTES de rodar isto
-- em produção. Depois que o hash é aplicado, o PIN original em
-- texto puro é perdido para sempre (esse é o objetivo), então se
-- algo sair errado no meio do caminho você precisa conseguir
-- restaurar os dados como estavam. Formas simples de fazer isso
-- no Supabase:
--   a) Table Editor → tabela "players" → menu "⋮" → Export data
--      as CSV (mais simples, leva 10 segundos).
--   b) SQL Editor → rodar `select * from public.players;` →
--      exportar o resultado.
--   c) Se seu plano Supabase tiver Point-in-Time Recovery/backups
--      automáticos, confirme que há um snapshot recente.
-- ============================================================

-- 1) Extensão de hash
create extension if not exists pgcrypto;

-- 2) Trigger: qualquer PIN gravado a partir de agora vira hash
--    automaticamente (INSERT ou UPDATE da coluna pin).
create or replace function public.hash_player_pin()
returns trigger
language plpgsql
as $$
begin
  if new.pin is not null and new.pin !~ '^\$2[aby]\$' then
    new.pin := crypt(new.pin, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_player_pin on public.players;
create trigger trg_hash_player_pin
before insert or update of pin on public.players
for each row
execute function public.hash_player_pin();

-- 3) Converte para hash os PINs que ainda estão em texto puro
--    (idempotente — não re-hasheia quem já é bcrypt).
update public.players
set pin = crypt(pin, gen_salt('bf'))
where pin is not null and pin !~ '^\$2[aby]\$';

-- 4a) Login: verifica identificador + PIN inteiramente no servidor.
--     Retorna 'result' = ok | not_found | wrong_pin | suspended | inactive
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
set search_path = public
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

  if v_player.pin is null or crypt(p_pin, v_player.pin) <> v_player.pin then
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

-- 4b) Confirma o PIN atual (usado no Perfil, antes de trocar o PIN)
create or replace function public.verify_own_pin(p_player_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select pin into v_hash from public.players where id = p_player_id;
  if v_hash is null then
    return false;
  end if;
  return crypt(p_pin, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_own_pin(uuid, text) from public;
grant execute on function public.verify_own_pin(uuid, text) to anon, authenticated;

-- 5) Ninguém mais lê a coluna pin (nem o hash) direto pela API.
--    A partir daqui, login e verificação de PIN só passam pelas
--    funções acima.
revoke select (pin) on public.players from anon, authenticated;
