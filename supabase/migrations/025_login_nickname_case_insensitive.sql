  -- ============================================================
  -- Migration 025 — Login por nickname deixa de diferenciar
  -- maiúsculas/minúsculas.
  --
  -- Antes: `p.nickname = p_identifier` exigia case exato (só o e-mail
  -- já era comparado com lower() dos dois lados). Agora nickname usa
  -- o mesmo padrão do e-mail.
  --
  -- Nenhum dado é alterado, apenas recria a função.
  -- ============================================================

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
    where lower(p.nickname) = lower(p_identifier) or lower(p.email) = lower(p_identifier)
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

    update public.players p
      set last_seen_at = now(),
          total_access = coalesce(v_player.total_access, 0) + 1
      where p.id = v_player.id;

    return query
      select 'ok'::text, v_player.id, v_player.nickname, v_player.email, v_player.category,
            v_player.admin_initials, coalesce(v_player.total_access, 0) + 1, v_player.status::text;
  end;
  $$;

  revoke all on function public.login_player(text, text) from public;
  grant execute on function public.login_player(text, text) to anon, authenticated;
