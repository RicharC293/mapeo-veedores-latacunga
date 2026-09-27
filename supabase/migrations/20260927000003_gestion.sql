-- Esquema de veedores, coordinadores, líderes y lista negra.
-- Estas tablas solo se leen/escriben desde el servidor (rutas API de Astro)
-- con la clave service_role, nunca desde el navegador: por eso quedan con
-- RLS activado y sin políticas para anon/authenticated.

create table public.veedores (
  id uuid primary key default gen_random_uuid(),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  nombres text not null,
  telefono text not null default '',
  junta_id text not null,
  recinto_codigo integer not null,
  parroquia_codigo integer not null,
  tipo text not null check (tipo in ('titular', 'suplente')),
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

create unique index veedores_cedula_unica on public.veedores (cedula);
create unique index veedores_junta_titular_unico on public.veedores (junta_id) where tipo = 'titular';
create index veedores_junta_idx on public.veedores (junta_id);
create index veedores_recinto_idx on public.veedores (recinto_codigo);

create table public.coordinadores (
  id uuid primary key default gen_random_uuid(),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  nombres text not null,
  telefono text not null default '',
  recinto_codigo integer not null,
  parroquia_codigo integer not null,
  tipo text not null check (tipo in ('titular', 'suplente')),
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

create unique index coordinadores_cedula_unica on public.coordinadores (cedula);
create unique index coordinadores_recinto_titular_unico on public.coordinadores (recinto_codigo) where tipo = 'titular';
create index coordinadores_recinto_idx on public.coordinadores (recinto_codigo);

create table public.lideres (
  id uuid primary key default gen_random_uuid(),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  nombres text not null,
  telefono text not null default '',
  ambito text not null check (ambito in ('general', 'parroquia')),
  parroquia_codigo integer,
  recinto_codigos integer[] not null default '{}',
  creado_en timestamptz not null default now(),
  constraint lideres_parroquia_segun_ambito check (
    (ambito = 'general' and parroquia_codigo is null)
    or (ambito = 'parroquia' and parroquia_codigo is not null)
  )
);

create unique index lideres_cedula_unica on public.lideres (cedula);

-- No hereda de "lista_negra": un líder eliminado nunca queda vetado.
create table public.lista_negra (
  id uuid primary key default gen_random_uuid(),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  nombres text not null,
  telefono text not null default '',
  motivo text,
  origen text not null check (origen in ('veedor', 'coordinador', 'manual')),
  creado_en timestamptz not null default now()
);

create unique index lista_negra_cedula_unica on public.lista_negra (cedula);

create table public.eventos_actividad (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('alta_veedor', 'baja_veedor', 'alta_coordinador', 'baja_coordinador')),
  cedula text not null,
  recinto_codigo integer not null,
  parroquia_codigo integer not null,
  fecha date not null,
  creado_en timestamptz not null default now()
);

create index eventos_fecha_idx on public.eventos_actividad (fecha);
create index eventos_parroquia_idx on public.eventos_actividad (parroquia_codigo);
create index eventos_recinto_idx on public.eventos_actividad (recinto_codigo);

alter table public.veedores enable row level security;
alter table public.coordinadores enable row level security;
alter table public.lideres enable row level security;
alter table public.lista_negra enable row level security;
alter table public.eventos_actividad enable row level security;

-- Funciones con la lógica de alta/desvinculación (incluye el ascenso
-- automático de suplente a titular). security definer + search_path fijo
-- porque necesitan escribir en lista_negra y eventos_actividad además de
-- su propia tabla; el acceso queda restringido a service_role más abajo.

create or replace function public.agregar_veedor(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_junta_id text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text
)
returns public.veedores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden integer;
  v_row public.veedores;
begin
  if trim(coalesce(p_nombres, '')) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if exists (select 1 from public.lista_negra where cedula = p_cedula) then
    raise exception 'Esta cédula está en la lista negra y no puede registrarse.';
  end if;
  if exists (select 1 from public.veedores where cedula = p_cedula) then
    raise exception 'Esta cédula ya está registrada como veedor.';
  end if;

  if p_tipo = 'titular' then
    if exists (select 1 from public.veedores where junta_id = p_junta_id and tipo = 'titular') then
      raise exception 'Esta junta ya tiene un veedor titular. Desvincúlelo primero.';
    end if;
    v_orden := 0;
  else
    select coalesce(max(orden), 0) + 1 into v_orden
      from public.veedores where junta_id = p_junta_id and tipo = 'suplente';
  end if;

  insert into public.veedores (cedula, nombres, telefono, junta_id, recinto_codigo, parroquia_codigo, tipo, orden)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), p_junta_id, p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_veedor', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;

create or replace function public.desvincular_veedor(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_veedor public.veedores;
  v_siguiente public.veedores;
begin
  select * into v_veedor from public.veedores where id = p_id;
  if not found then
    raise exception 'No se encontró el veedor.';
  end if;

  delete from public.veedores where id = p_id;

  if v_veedor.tipo = 'titular' then
    select * into v_siguiente from public.veedores
      where junta_id = v_veedor.junta_id and tipo = 'suplente'
      order by orden asc limit 1;
    if found then
      update public.veedores set tipo = 'titular', orden = 0 where id = v_siguiente.id;
      update public.veedores set orden = orden - 1
        where junta_id = v_veedor.junta_id and tipo = 'suplente' and orden > v_siguiente.orden;
    end if;
  else
    update public.veedores set orden = orden - 1
      where junta_id = v_veedor.junta_id and tipo = 'suplente' and orden > v_veedor.orden;
  end if;

  insert into public.lista_negra (cedula, nombres, telefono, motivo, origen)
  values (v_veedor.cedula, v_veedor.nombres, v_veedor.telefono, p_motivo, 'veedor')
  on conflict (cedula) do update set
    nombres = excluded.nombres,
    telefono = excluded.telefono,
    motivo = excluded.motivo,
    origen = excluded.origen;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_veedor', v_veedor.cedula, v_veedor.recinto_codigo, v_veedor.parroquia_codigo, current_date);
end;
$$;

create or replace function public.agregar_coordinador(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text
)
returns public.coordinadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden integer;
  v_row public.coordinadores;
begin
  if trim(coalesce(p_nombres, '')) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if exists (select 1 from public.lista_negra where cedula = p_cedula) then
    raise exception 'Esta cédula está en la lista negra y no puede registrarse.';
  end if;
  if exists (select 1 from public.coordinadores where cedula = p_cedula) then
    raise exception 'Esta cédula ya está registrada como coordinador.';
  end if;

  if p_tipo = 'titular' then
    if exists (select 1 from public.coordinadores where recinto_codigo = p_recinto_codigo and tipo = 'titular') then
      raise exception 'Este recinto ya tiene un coordinador titular. Desvincúlelo primero.';
    end if;
    v_orden := 0;
  else
    select coalesce(max(orden), 0) + 1 into v_orden
      from public.coordinadores where recinto_codigo = p_recinto_codigo and tipo = 'suplente';
  end if;

  insert into public.coordinadores (cedula, nombres, telefono, recinto_codigo, parroquia_codigo, tipo, orden)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_coordinador', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;

create or replace function public.desvincular_coordinador(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coordinador public.coordinadores;
  v_siguiente public.coordinadores;
begin
  select * into v_coordinador from public.coordinadores where id = p_id;
  if not found then
    raise exception 'No se encontró el coordinador.';
  end if;

  delete from public.coordinadores where id = p_id;

  if v_coordinador.tipo = 'titular' then
    select * into v_siguiente from public.coordinadores
      where recinto_codigo = v_coordinador.recinto_codigo and tipo = 'suplente'
      order by orden asc limit 1;
    if found then
      update public.coordinadores set tipo = 'titular', orden = 0 where id = v_siguiente.id;
      update public.coordinadores set orden = orden - 1
        where recinto_codigo = v_coordinador.recinto_codigo and tipo = 'suplente' and orden > v_siguiente.orden;
    end if;
  else
    update public.coordinadores set orden = orden - 1
      where recinto_codigo = v_coordinador.recinto_codigo and tipo = 'suplente' and orden > v_coordinador.orden;
  end if;

  insert into public.lista_negra (cedula, nombres, telefono, motivo, origen)
  values (v_coordinador.cedula, v_coordinador.nombres, v_coordinador.telefono, p_motivo, 'coordinador')
  on conflict (cedula) do update set
    nombres = excluded.nombres,
    telefono = excluded.telefono,
    motivo = excluded.motivo,
    origen = excluded.origen;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_coordinador', v_coordinador.cedula, v_coordinador.recinto_codigo, v_coordinador.parroquia_codigo, current_date);
end;
$$;

-- Por defecto Postgres otorga EXECUTE a PUBLIC en funciones nuevas.
-- Lo revocamos explícitamente: solo el servidor (service_role) debe
-- poder ejecutar estas funciones, ya que "security definer" les permite
-- saltarse RLS.
revoke execute on function public.agregar_veedor(text, text, text, text, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.desvincular_veedor(uuid, text) from public, anon, authenticated;
revoke execute on function public.agregar_coordinador(text, text, text, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.desvincular_coordinador(uuid, text) from public, anon, authenticated;

grant execute on function public.agregar_veedor(text, text, text, text, integer, integer, text) to service_role;
grant execute on function public.desvincular_veedor(uuid, text) to service_role;
grant execute on function public.agregar_coordinador(text, text, text, integer, integer, text) to service_role;
grant execute on function public.desvincular_coordinador(uuid, text) to service_role;
