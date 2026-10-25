-- Validación de cédulas contra una API pública (ecuadorapi.com), una sola vez
-- por cédula: la validación no se cuelga de un registro (militante, veedor,
-- coordinador...) sino de la cédula, que es lo que comparten todas las tablas.
-- Así una persona que pasa de Militancia a veedor, cambia de recinto o se carga
-- repetida no se vuelve a pagar.
create table public.validaciones_cedula (
  cedula text primary key check (cedula ~ '^[0-9]{10}$'),
  -- validada: la API devolvió los datos. no_encontrada: la API respondió que
  -- no existe (también se paga, así que no se repite). error: falla técnica,
  -- se reintenta en la siguiente corrida.
  estado text not null check (estado in ('validada', 'no_encontrada', 'error')),
  nombres text,
  apellidos text,
  nombre_completo text,
  -- Respuesta íntegra de la API, tal como llegó.
  respuesta jsonb,
  http_status integer,
  error text,
  intentos integer not null default 1,
  proveedor text not null default 'ecuadorapi',
  consultado_en timestamptz not null default now()
);

create index validaciones_cedula_estado_idx on public.validaciones_cedula (estado);

alter table public.validaciones_cedula enable row level security;
-- Sin políticas: trae datos personales del Registro Civil y solo se lee y
-- escribe desde el servidor con la clave secret, como el resto de gestión.
