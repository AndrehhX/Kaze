-- ════════════════════════════════════════════════════════════════════
-- Apoya KAZE: quienes apoyan en Ko-fi reciben cosméticos (el anime sigue gratis).
--
--  supporters          estado público de cada cuenta que apoya (nivel, vencimiento,
--                      Fundador y cosméticos puestos). Lectura pública; escritura
--                      SOLO con la clave de servicio (sin políticas de escritura),
--                      así nadie puede darse un nivel a sí mismo.
--  supporter_payments  pagos que llegan por el webhook de Ko-fi. Privada: RLS sin
--                      políticas (solo la clave de servicio la lee).
--  supporter_votes     votos de las encuestas de quienes apoyan en Tormenta. Privada.
--
-- Solo crea cosas nuevas: no borra ni cambia nada que ya exista.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.supporters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  tier smallint not null default 1 check (tier between 1 and 3),
  expires_at timestamptz,
  founder boolean not null default false,
  since timestamptz not null default now(),
  show_on_wall boolean not null default true,
  equipped jsonb not null default '{}'::jsonb,
  manual_tier smallint check (manual_tier between 1 and 3),
  manual_until timestamptz,
  last_payment_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.supporters enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'supporters' and policyname = 'supporters_public_read') then
    create policy supporters_public_read on public.supporters for select using (true);
  end if;
end $$;

-- Solo lectura para el público: las columnas de regalos manuales no hacen falta fuera.
revoke all on public.supporters from anon, authenticated;
grant select (user_id, tier, expires_at, founder, since, show_on_wall, equipped) on public.supporters to anon, authenticated;

create index if not exists supporters_wall_idx on public.supporters (tier desc, since) where show_on_wall;

create table if not exists public.supporter_payments (
  id bigserial primary key,
  kofi_transaction_id text not null unique,
  message_id text,
  type text not null,
  tier_name text,
  tier smallint check (tier between 1 and 3),
  amount numeric(10, 2) not null default 0,
  currency text not null default 'USD',
  email text,
  from_name text,
  message text,
  is_public boolean not null default false,
  is_subscription boolean not null default false,
  user_id uuid references public.profiles (id) on delete set null,
  received_at timestamptz not null default now()
);

alter table public.supporter_payments enable row level security;
revoke all on public.supporter_payments from anon, authenticated;

create index if not exists supporter_payments_user_idx on public.supporter_payments (user_id, received_at desc);
create index if not exists supporter_payments_email_idx on public.supporter_payments (lower(email)) where user_id is null;
create index if not exists supporter_payments_month_idx on public.supporter_payments (received_at);

create table if not exists public.supporter_votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  poll text not null check (char_length(poll) <= 40),
  option text not null check (char_length(option) <= 40),
  created_at timestamptz not null default now(),
  primary key (user_id, poll)
);

alter table public.supporter_votes enable row level security;
revoke all on public.supporter_votes from anon, authenticated;
