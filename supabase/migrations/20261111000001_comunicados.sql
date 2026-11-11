-- Comunicados por WhatsApp: avisos a las personas del Consolidado (y, si se
-- elige, a Militancia) con un mensaje que se completa con los datos de cada
-- una. Los destinatarios no se guardan: salen de los filtros cada vez, así un
-- comunicado sigue al día si alguien entra o cambia de puesto.
create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  -- Plantilla con {nombre}, {rol}, {recinto}, {parroquia}, {direccion},
  -- {junta} y {enlace}.
  mensaje text not null default '',
  enlace text not null default '',
  -- Ubicación, recinto, dignidades, titular o suplente, responsable y si
  -- incluye a Militancia (ver FiltrosComunicado en src/lib/comunicados).
  filtros jsonb not null default '{}'::jsonb,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- A qué celulares ya se les envió cada comunicado. Va por número y no por
-- persona: quienes comparten celular reciben un solo mensaje.
create table public.comunicado_envios (
  comunicado_id uuid not null references public.comunicados (id) on delete cascade,
  numero text not null check (numero ~ '^5939[0-9]{8}$'),
  enviado_por text,
  enviado_en timestamptz not null default now(),
  primary key (comunicado_id, numero)
);

alter table public.comunicados enable row level security;
alter table public.comunicado_envios enable row level security;
-- Sin políticas: traen celulares y solo se leen y escriben desde el servidor
-- con la clave secret, como el resto de gestión.
