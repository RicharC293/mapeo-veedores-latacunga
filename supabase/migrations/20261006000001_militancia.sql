-- "Militancia": bandeja de personas con datos básicos (cédula, nombres,
-- celular) pendientes de asignación como veedor, coordinador o acreditado
-- CDA. Pensada para agilizar la carga masiva de datos: primero se sube la
-- gente con lo mínimo (individualmente o en bloque), después se le asigna
-- destino fila por fila sin tener que volver a escribir cédula/nombre/
-- teléfono. No hay control de duplicados al insertar (se resuelven después,
-- marcándolos como "Duplicado" en la UI); tampoco replica las reglas de
-- lista_negra/veedores/etc., esas se aplican recién al asignar (ver
-- agregar_veedor/agregar_coordinador/agregar_acreditado_cda).

create table public.militantes (
  id uuid primary key default gen_random_uuid(),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  nombres text not null,
  telefono text not null default '',
  responsable_lider_id uuid references public.lideres (id) on delete set null,
  -- Preasignación opcional desde la importación masiva (todo el lote a la
  -- vez): solo "pre-llenan" los dropdowns de la fila en Militancia, no
  -- asignan a la persona todavía — eso sigue pasando al presionar el check
  -- en la fila (y ahí recién se valida contra lista_negra/duplicados en la
  -- tabla destino). Igual que recinto_codigo en veedores/coordinadores/
  -- acreditados_cda, sin FK: los recintos no son una tabla, son datos
  -- estáticos (GeoJSON) que sirve getMapData().
  recinto_codigo integer,
  parroquia_codigo integer,
  tipo_preasignado text check (tipo_preasignado in ('veedor', 'coordinador', 'cda')),
  creado_en timestamptz not null default now(),
  constraint militantes_recinto_y_parroquia_juntos check (
    (recinto_codigo is null) = (parroquia_codigo is null)
  )
);

create index militantes_cedula_idx on public.militantes (cedula);
create index militantes_responsable_lider_idx on public.militantes (responsable_lider_id);

alter table public.militantes enable row level security;
-- Sin políticas: mismo patrón que el resto de tablas de gestión, solo
-- accesible con la clave service_role, desde rutas API del servidor.
