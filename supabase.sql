-- WAAW Kit Store - banco de reservas no Supabase
-- Execute este arquivo no SQL Editor do seu projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid,
  name text not null,
  contact text,
  number integer not null check (number between 0 and 100),
  color text not null check (color in ('preto', 'branco')),
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'rejeitado', 'cancelado')),
  amount numeric(10,2) not null default 89.90,
  txid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  expires_at timestamptz,
  obs text
);

create index if not exists reservations_created_at_idx
  on public.reservations (created_at desc);

create index if not exists reservations_group_id_idx
  on public.reservations (group_id);

create index if not exists reservations_status_idx
  on public.reservations (status);

-- O mesmo numero pode existir no preto e no branco, mas nao pode haver
-- duas reservas ativas para a mesma cor + numero.
create unique index if not exists reservations_active_number_unique
  on public.reservations (color, number)
  where status in ('pago', 'pendente');

-- Libera automaticamente uma reserva pendente vencida quando alguem tentar
-- ocupar o mesmo numero + cor novamente.
create or replace function public.release_expired_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reservations
     set status = 'cancelado',
         updated_at = now(),
         obs = case
                 when coalesce(obs, '') = '' then 'Reserva expirada automaticamente.'
                 else obs || E'\nReserva expirada automaticamente.'
               end
   where color = new.color
     and number = new.number
     and status = 'pendente'
     and expires_at is not null
     and expires_at <= now();

  return new;
end;
$$;

drop trigger if exists trg_release_expired_pending on public.reservations;
create trigger trg_release_expired_pending
before insert on public.reservations
for each row execute function public.release_expired_pending();

-- Reserva de 1 a 4 kits (max. 2 por cor) em uma unica transacao. Se algum
-- numero estiver ocupado, nada e gravado, evitando vender o mesmo numero
-- para duas pessoas.
create or replace function public.reserve_kits(
  p_name text,
  p_contact text,
  p_items jsonb,
  p_amount numeric,
  p_txid text,
  p_group_id uuid
)
returns setof public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_number integer;
  v_color text;
  v_now timestamptz := now();
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'INVALID_NAME';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 4 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Maximo de 2 kits por cor dentro do mesmo pedido (ex: 2 preto + 2 branco).
  if (
    select count(*) from jsonb_array_elements(p_items) e where e.value->>'color' = 'preto'
  ) > 2 then
    raise exception 'MAX_PER_COLOR';
  end if;
  if (
    select count(*) from jsonb_array_elements(p_items) e where e.value->>'color' = 'branco'
  ) > 2 then
    raise exception 'MAX_PER_COLOR';
  end if;

  -- Antes de verificar disponibilidade, tira do caminho as reservas vencidas.
  update public.reservations
     set status = 'cancelado',
         updated_at = v_now,
         obs = case
                 when coalesce(obs, '') = '' then 'Reserva expirada automaticamente.'
                 else obs || E'\nReserva expirada automaticamente.'
               end
   where status = 'pendente'
     and expires_at is not null
     and expires_at <= v_now;

  for item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_number := (item->>'number')::integer;
    exception when others then
      raise exception 'INVALID_NUMBER';
    end;

    v_color := item->>'color';

    if v_number is null or v_number < 0 or v_number > 100 then
      raise exception 'INVALID_NUMBER';
    end if;

    if v_color not in ('preto', 'branco') then
      raise exception 'INVALID_COLOR';
    end if;
  end loop;

  return query
  insert into public.reservations (
    id, group_id, name, contact, number, color, status,
    amount, txid, created_at, expires_at
  )
  select
    gen_random_uuid(),
    p_group_id,
    upper(left(btrim(p_name), 30)),
    nullif(left(btrim(coalesce(p_contact, '')), 60), ''),
    (value->>'number')::integer,
    value->>'color',
    'pendente',
    p_amount,
    left(p_txid, 25),
    v_now,
    v_now + interval '30 minutes'
  from jsonb_array_elements(p_items)
  returning *;
exception
  when unique_violation then
    raise exception 'NUMBER_TAKEN';
end;
$$;

-- Endpoint RPC usado pelo painel para limpar reservas vencidas.
create or replace function public.expire_pending_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.reservations
     set status = 'cancelado',
         updated_at = now(),
         obs = case
                 when coalesce(obs, '') = '' then 'Reserva expirada automaticamente.'
                 else obs || E'\nReserva expirada automaticamente.'
               end
   where status = 'pendente'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- RLS: o site usa a service role no backend Next.js. Nao coloque a service
-- role key no navegador. As tabelas permanecem fechadas para anon/auth.
alter table public.reservations enable row level security;

drop policy if exists "reservations_no_anon_access" on public.reservations;
create policy "reservations_no_anon_access"
  on public.reservations
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Dados iniciais que ja estavam no projeto.
insert into public.reservations
  (id, group_id, name, number, color, status, amount, txid, created_at, obs)
values
  ('00000000-0000-4000-8000-000000000001', null, 'MARCEL', 10, 'preto', 'pago', 89.90, 'SEEDMARCEL10P', '2026-09-01T12:00:00Z', null),
  ('00000000-0000-4000-8000-000000000002', null, 'MARCEL', 10, 'branco', 'pago', 89.90, 'SEEDMARCEL10B', '2026-09-01T12:01:00Z', null),
  ('00000000-0000-4000-8000-000000000003', null, 'JOSE TELLES', 8, 'preto', 'pago', 89.90, 'SEEDJOSE8P', '2026-09-01T12:02:00Z', null),
  ('00000000-0000-4000-8000-000000000004', null, 'JOSE TELLES', 8, 'branco', 'pago', 89.90, 'SEEDJOSE8B', '2026-09-01T12:03:00Z', null),
  ('00000000-0000-4000-8000-000000000005', null, 'FELIPE BARBOSA', 9, 'preto', 'pago', 89.90, 'SEEDFELIPE9P', '2026-09-01T12:04:00Z', null),
  ('00000000-0000-4000-8000-000000000006', null, 'FELIPE BARBOSA', 9, 'branco', 'pago', 89.90, 'SEEDFELIPE9B', '2026-09-01T12:05:00Z', null),
  ('00000000-0000-4000-8000-000000000007', null, 'CICERO', 7, 'branco', 'pago', 89.90, 'SEEDCICERO7B', '2026-09-01T12:06:00Z', null),
  ('00000000-0000-4000-8000-000000000008', null, 'PAULO', 10, 'branco', 'rejeitado', 89.90, 'SEEDPAULO10B', '2026-09-01T12:07:00Z', 'Numero 10 branco ja estava reservado para MARCEL. Solicitacao registrada apenas para historico, nao ocupa o numero.')
on conflict (id) do nothing;

-- Permite que o backend da aplicacao execute as funcoes RPC.
grant execute on function public.reserve_kits(text, text, jsonb, numeric, text, uuid) to service_role;
grant execute on function public.expire_pending_reservations() to service_role;
