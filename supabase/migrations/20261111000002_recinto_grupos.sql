-- Grupo de WhatsApp de cada recinto: el enlace de invitación que se carga
-- desde el Consolidado y que los comunicados ponen donde dice {grupo}.
create table public.recinto_grupos (
  recinto_codigo integer primary key,
  enlace text not null check (enlace ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);

alter table public.recinto_grupos enable row level security;
-- Sin políticas: solo se lee y escribe desde el servidor con la clave
-- secret, como el resto de gestión.
