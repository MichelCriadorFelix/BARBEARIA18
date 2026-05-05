-- Habilitar extensão de UUID
create extension if not exists "uuid-ossp";

-- 1. Tabela de Barbearias (Criar apenas se não existir)
create table if not exists barbershops (
  id uuid primary key, 
  name text,
  logo_url text,
  invite_code text unique,
  working_hours jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilita políticas de storage para o bucket 'logos' e 'documentsbarbearia'
-- Nota: O bucket deve ser criado manualmente no painel ou via API de infra, aqui garantimos as políticas.
-- Independentemente, o ideal é usar a tabela para metadados.

-- Adiciona colunas se a tabela já existia sem elas
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='barbershops' and column_name='invite_code') then 
    alter table barbershops add column invite_code text unique; 
  end if; 
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='barbershops' and column_name='working_hours') then 
    alter table barbershops add column working_hours jsonb; 
  end if; 
end 
$$;

-- Ativar RLS e Criar Políticas para barbearias
alter table barbershops enable row level security;
drop policy if exists "Read access on barbershops" on barbershops;
create policy "Read access on barbershops" on barbershops for select using (true);

drop policy if exists "Insert/Update barbershops" on barbershops;
create policy "Insert/Update barbershops" on barbershops for all to authenticated using (
  auth.uid() = id OR 
  id = (select barbershop_id from profiles where id = auth.uid() and role in ('master', 'barber'))
) with check (
  auth.uid() = id OR 
  id = (select barbershop_id from profiles where id = auth.uid() and role in ('master', 'barber'))
);

-- 2. Atualizar a Tabela de Perfis de forma segura
do $$ 
begin 
  -- Cria a tabela profiles se não existir
  if not exists (select from pg_tables where schemaname = 'public' and tablename  = 'profiles') then
    create table profiles (
      id uuid references auth.users on delete cascade primary key,
      role text check (role in ('master', 'barber', 'client')) default 'client',
      full_name text,
      phone text,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
    );
  end if;

  -- Adiciona a coluna barbershop_id se não existir
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='barbershop_id') then 
    alter table profiles add column barbershop_id uuid references barbershops(id); 
  end if;
  
  -- Adiciona chave pix para os profissionais
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='pix_key') then 
    alter table profiles add column pix_key text; 
  end if; 

  -- Adiciona whatsapp para os profissionais
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='whatsapp_number') then 
    alter table profiles add column whatsapp_number text; 
  end if; 
end 
$$;

-- 3. Atualizar a Tabela de Serviços de forma segura
do $$ 
begin 
  if not exists (select from pg_tables where schemaname = 'public' and tablename  = 'services') then
    create table services (
      id uuid default uuid_generate_v4() primary key,
      barbershop_id uuid references barbershops(id) not null,
      name text not null,
      price numeric not null,
      duration integer not null default 30, -- Em minutos, base do agendamento
      active boolean default true,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
    );
  else
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='services' and column_name='barbershop_id') then 
      alter table services add column barbershop_id uuid references barbershops(id); 
    end if;
  end if;
end 
$$;

-- 4. Tabela de Agendamentos
create table if not exists appointments (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references profiles(id) not null,
  service_id uuid references services(id) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text check (status in ('pending', 'confirmed', 'completed', 'cancelled')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar o modo Realtime para atualizações em tempo real 
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table appointments;
  end if;
end
$$;

-- 5. Tabela de Transações (CRM Financeiro) de forma segura
do $$ 
begin 
  if not exists (select from pg_tables where schemaname = 'public' and tablename  = 'transactions') then
    create table transactions (
      id uuid default uuid_generate_v4() primary key,
      barbershop_id uuid references barbershops(id) not null,
      type text check (type in ('income', 'expense', 'fixed_cost', 'variable_cost')) not null,
      amount numeric not null,
      description text not null,
      date date not null default current_date,
      appointment_id uuid references appointments(id),
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
    );
  else
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='barbershop_id') then 
      alter table transactions add column barbershop_id uuid references barbershops(id); 
    end if;
  end if;
end 
$$;

-- Atualizar o trigger public.handle_new_user() para o novo padrão de roles ('client', 'master', 'barber')
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Usuário'), 
    'client' -- Atenção para a role default
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atualizar políticas de Profiles

-- Helper functions to avoid infinite recursion in RLS
create or replace function get_my_barbershop_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select barbershop_id from profiles where id = auth.uid();
$$;

create or replace function get_my_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function get_booked_slots(
  p_barbershop_id uuid,
  p_start timestamp with time zone,
  p_end timestamp with time zone
)
returns table (
  start_time timestamp with time zone,
  end_time timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  select a.start_time, a.end_time 
  from appointments a
  join services s on s.id = a.service_id
  where s.barbershop_id = p_barbershop_id
  and a.status in ('pending', 'confirmed', 'completed')
  and a.start_time >= p_start
  and a.start_time <= p_end;
$$;

create or replace function admin_toggle_barber(
  p_user_id uuid,
  p_role text,
  p_barbershop_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role = 'master' then
    update profiles 
    set role = p_role, barbershop_id = p_barbershop_id 
    where id = p_user_id;
  else
    raise exception 'Permission denied';
  end if;
end;
$$;

alter table profiles enable row level security;
drop policy if exists "Read profiles" on profiles;
create policy "Read profiles" on profiles for select to authenticated using (
  auth.uid() = id OR 
  barbershop_id = get_my_barbershop_id() OR
  get_my_role() in ('master', 'barber') OR
  role in ('master', 'barber')
);

drop policy if exists "Insert profiles" on profiles;
create policy "Insert profiles" on profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Update profiles" on profiles;
create policy "Update profiles" on profiles for update to authenticated using (
  auth.uid() = id OR 
  get_my_role() = 'master' OR
  (
    get_my_role() = 'barber'
    AND
    (get_my_barbershop_id() = barbershop_id OR barbershop_id IS NULL)
  )
);

-- Atualizar políticas de Services
alter table services enable row level security;
drop policy if exists "Read access on services for authenticated" on services;
create policy "Read access on services for authenticated" on services for select using (true);

drop policy if exists "Admin can insert services" on services;
create policy "Admin can insert services" on services for all to authenticated using (
  get_my_role() in ('master', 'barber') 
  and get_my_barbershop_id() = services.barbershop_id
);

-- Atualizar políticas de Appointments
alter table appointments enable row level security;
drop policy if exists "Read appointments" on appointments;
create policy "Read appointments" on appointments for select to authenticated using (
  client_id = auth.uid() OR 
  exists (
    select 1 from services s 
    where s.id = appointments.service_id 
    and s.barbershop_id = get_my_barbershop_id()
  )
);

drop policy if exists "Insert appointments" on appointments;
create policy "Insert appointments" on appointments for insert to authenticated with check (
  client_id = auth.uid() OR 
  (
    get_my_role() in ('master', 'barber') AND
    exists (
      select 1 from services s 
      where s.id = appointments.service_id 
      and s.barbershop_id = get_my_barbershop_id()
    )
  )
);

drop policy if exists "Update appointments" on appointments;
create policy "Update appointments" on appointments for update to authenticated using (
  client_id = auth.uid() OR 
  (
    get_my_role() in ('master', 'barber') AND
    exists (
      select 1 from services s 
      where s.id = appointments.service_id 
      and s.barbershop_id = get_my_barbershop_id()
    )
  )
);

-- Atualizar políticas de Transactions
alter table transactions enable row level security;
drop policy if exists "Admin transactions" on transactions;
create policy "Admin transactions" on transactions for all to authenticated using (
  get_my_role() in ('master', 'barber') 
  and get_my_barbershop_id() = transactions.barbershop_id
) with check (
  get_my_role() in ('master', 'barber') 
  and get_my_barbershop_id() = transactions.barbershop_id
);
