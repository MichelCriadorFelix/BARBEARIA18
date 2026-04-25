# Configuração do Supabase (Atualizado)

Para que o aplicativo funcione perfeitamente com autenticação, banco de dados e CRM da BARBEARIA 18.

## 1. Crie o Projeto
1. Acesse [Supabase.com](https://supabase.com/) e crie um novo projeto.
2. Vá em **Project Settings -> API** e copie o `Project URL` e a `anon public key`.
3. Adicione essas chaves no painel de Segredos (Secrets), Vercel ou no `.env` do projeto como `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

## 2. Ative o Autenticador do Google
1. Ainda no Supabase, vá na aba **Authentication -> Providers** e clique em **Google**.
2. Habilite a integração fornecendo seu **Client ID** e **Client Secret** (obtidos no Google Cloud Console).
3. Certifique-se de configurar a URL de Callback fornecida lá dentro do Google Cloud Console.

## 3. Execute o Script SQL
Vá até a aba **SQL Editor** no painel do Supabase, crie uma nova query, cole o código abaixo e clique em **Run**:

```sql
-- Habilitar extensão de UUID
create extension if not exists "uuid-ossp";

-- 1. Tabela de Perfis
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('admin', 'user', 'client')) default 'user',
  full_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Serviços (Catálogo)
create table services (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price numeric not null,
  duration integer not null default 30, -- Em minutos, base do agendamento
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Agendamentos
create table appointments (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references profiles(id) not null,
  service_id uuid references services(id) not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text check (status in ('pending', 'confirmed', 'completed', 'cancelled')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar o modo Realtime para atualizações em tempo real 
alter publication supabase_realtime add table appointments;

-- 4. Tabela de Transações (CRM Financeiro)
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  type text check (type in ('income', 'expense', 'fixed_cost', 'variable_cost')) not null,
  amount numeric not null,
  description text not null,
  date date not null default current_date,
  appointment_id uuid references appointments(id), -- Opcional, para faturamento de cortes
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -----------------------------------------------------
-- Trigger Automático: Criar perfil ao registrar usuário (Compatível com Google)
-- -----------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id, 
    -- Resgatar o nome vindo do provider oauth (ex: Google)
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Usuário'), 
    'user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------
-- Segurança Simples (RLS) para este App
-- -----------------------------------------------------
alter table profiles enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table transactions enable row level security;

-- Todos os usuários logados podem ler o catálogo de serviços
create policy "Read access on services for authenticated" on services for select to authenticated using (true);
create policy "Admin can insert services" on services for all to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Perfis: Podem ver todos os perfis, inserir e editar o seu
create policy "Read profiles" on profiles for select to authenticated using (true);
create policy "Insert profiles" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "Update own profile" on profiles for update to authenticated using (auth.uid() = id);

-- Agendamentos: Todos autênticados podem ver os horários (para ver disponibilidade), mas somente o dono ou admin edita
create policy "Read appointments" on appointments for select to authenticated using (true);
create policy "Insert appointments" on appointments for insert to authenticated with check (
  client_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Update appointments" on appointments for update to authenticated using (
  client_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Transações Financeiras: Somente Admin
create policy "Admin transactions" on transactions for all to authenticated using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- -----------------------------------------------------
-- 5. STORAGE: Configuração da Logo
-- -----------------------------------------------------
-- 1. No Supabase, vá em Storage -> New Bucket.
-- 2. Nome do bucket: "documentsbarbearia"
-- 3. Marque a opção "Public bucket" (importante para que todos vejam a imagem).
-- 4. Clique em "Save".
-- 5. Vá em "Policies" no menu lateral do Storage.
-- 6. No bucket "documentsbarbearia", adicione estas políticas via SQL Editor (mais fácil):

/*
-- COLE ISTO NO SQL EDITOR DO SUPABASE PARA LIBERAR O UPLOAD:

CREATE POLICY "Acesso Publico Leitura" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'documentsbarbearia' );

CREATE POLICY "Admin Gerenciar Tudo" ON storage.objects FOR ALL TO authenticated USING (
  bucket_id = 'documentsbarbearia' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
) WITH CHECK (
  bucket_id = 'documentsbarbearia' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
*/
-- -----------------------------------------------------
-- 6. REALTIME: Ativação em Tempo Real (MUITO IMPORTANTE)
-- -----------------------------------------------------
-- Para que o horário suma no celular de outras pessoas instantaneamente sem precisar atualizar a página:
-- 1. No seu painel do Supabase, vá na aba "Database" (ícone de cilindro no menu lateral).
-- 2. Clique em "Replication".
-- 3. Em "Supabase Realtime", você verá uma tabela chamada "supabase_realtime" ou um link como "0 tables".
-- 4. Clique para gerenciar as tabelas e MARQUE a caixa da tabela "appointments".
-- 5. Salve a alteração.
-- Fazendo isso, o banco de dados vai "avisar" todos os celulares conectados sempre que um horário for ocupado!

-- -----------------------------------------------------
-- 7. LIMPEZA DE DADOS (OPCIONAL)
-- -----------------------------------------------------
-- Se quiser apagar todos os agendamentos de teste:
-- DELETE FROM appointments;

```

## 4. Insira do Administrador (Eduardo Gomes)
A primeira conta que você logar (mesmo sendo do Google) será criada como `client`. Para virar o barbeiro (admin), vá ao Banco de Dados no Supabase, abra a tabela `profiles` e altere a coluna `role` do seu usuário logado para `admin`.

## 5. Deploy na Vercel
Quando for criar seu Deploy pela Vercel no GitHub, certifique-se de adicionar `SUPABASE_URL` e `SUPABASE_ANON_KEY` nas Configurações de Ambient Variables do Vercel Dashboard.
