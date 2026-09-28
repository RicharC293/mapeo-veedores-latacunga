-- Enlaces únicos de acceso para los roles militante/gestor (el rol
-- administrador es una cuenta normal de Supabase Auth, no vive aquí).
-- Solo se lee/escribe desde el servidor con la clave secret.

create table public.accesos (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  rol text not null check (rol in ('militante', 'gestor')),
  etiqueta text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  ultimo_uso_en timestamptz
);

create unique index accesos_token_unico on public.accesos (token);

alter table public.accesos enable row level security;
