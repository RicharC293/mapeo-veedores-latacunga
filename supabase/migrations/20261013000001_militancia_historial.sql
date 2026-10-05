-- Historial de ediciones de Militancia: cada vez que alguien corrige los
-- datos de una persona (cédula, nombres, celular, correo, preferencia o
-- responsable) se guarda qué cambió, quién lo hizo y cuándo. "cambios" es una
-- lista de {campo, antes, despues}. Si la persona sale de Militancia (se
-- asigna o se elimina), su historial se borra con ella.

create table public.militantes_historial (
  id uuid primary key default gen_random_uuid(),
  militante_id uuid not null references public.militantes (id) on delete cascade,
  usuario text not null default '',
  cambios jsonb not null,
  creado_en timestamptz not null default now()
);

create index militantes_historial_militante_idx
  on public.militantes_historial (militante_id, creado_en desc);

alter table public.militantes_historial enable row level security;
-- Sin políticas: solo accesible con la clave service_role desde el servidor.
