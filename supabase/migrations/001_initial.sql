-- Rode no SQL Editor do Supabase (ou via CLI). Ajuste políticas conforme sua política de moderação.

create table if not exists public.question_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pack_questions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.question_packs (id) on delete cascade,
  sort_order int not null,
  payload jsonb not null
);

create index if not exists idx_pack_questions_pack on public.pack_questions (pack_id);

alter table public.question_packs enable row level security;
alter table public.pack_questions enable row level security;

create policy "question_packs_select_public"
  on public.question_packs for select
  using (is_public = true);

create policy "question_packs_insert_own"
  on public.question_packs for insert
  with check (auth.uid() = owner_id);

create policy "question_packs_update_own"
  on public.question_packs for update
  using (auth.uid() = owner_id);

create policy "pack_questions_select_public_pack"
  on public.pack_questions for select
  using (
    exists (
      select 1 from public.question_packs qp
      where qp.id = pack_id and qp.is_public = true
    )
  );

create policy "pack_questions_insert_own_pack"
  on public.pack_questions for insert
  with check (
    exists (
      select 1 from public.question_packs qp
      where qp.id = pack_id and qp.owner_id = auth.uid()
    )
  );
