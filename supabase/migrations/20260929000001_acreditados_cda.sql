-- Persona acreditada por el CNE para el Centro de Digitalización de Actas
-- (CDA) de un recinto: un rol distinto del coordinador de recinto, aplicable
-- solo a los recintos marcados como CDA. Mismo patrón que coordinadores.

create table public.acreditados_cda (
  id uuid primary key default gen_random_uuid(),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  nombres text not null,
  telefono text not null default '',
  recinto_codigo integer not null,
  parroquia_codigo integer not null,
  tipo text not null check (tipo in ('titular', 'suplente')),
  orden integer not null default 0,
  verificado boolean not null default false,
  creado_en timestamptz not null default now()
);

create unique index acreditados_cda_cedula_unica on public.acreditados_cda (cedula);
create unique index acreditados_cda_recinto_titular_unico on public.acreditados_cda (recinto_codigo) where tipo = 'titular';
create index acreditados_cda_recinto_idx on public.acreditados_cda (recinto_codigo);

alter table public.acreditados_cda enable row level security;

-- Los checks de origen/tipo en lista_negra y eventos_actividad se crearon sin
-- nombre explícito (Postgres los nombra "<tabla>_<columna>_check"), así que
-- los buscamos dinámicamente en vez de asumir ese nombre.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'lista_negra'
      and att.attname = 'origen'
      and con.contype = 'c'
  loop
    execute format('alter table public.lista_negra drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.lista_negra
  add constraint lista_negra_origen_check
  check (origen in ('veedor', 'coordinador', 'acreditado_cda', 'manual'));

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'eventos_actividad'
      and att.attname = 'tipo'
      and con.contype = 'c'
  loop
    execute format('alter table public.eventos_actividad drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.eventos_actividad
  add constraint eventos_actividad_tipo_check
  check (tipo in (
    'alta_veedor', 'baja_veedor',
    'alta_coordinador', 'baja_coordinador',
    'alta_acreditado_cda', 'baja_acreditado_cda'
  ));

create or replace function public.agregar_acreditado_cda(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text
)
returns public.acreditados_cda
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden integer;
  v_row public.acreditados_cda;
begin
  if trim(coalesce(p_nombres, '')) = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if exists (select 1 from public.lista_negra where cedula = p_cedula) then
    raise exception 'Esta cédula está en la lista negra y no puede registrarse.';
  end if;
  if exists (select 1 from public.acreditados_cda where cedula = p_cedula) then
    raise exception 'Esta cédula ya está registrada como acreditado CDA.';
  end if;

  if p_tipo = 'titular' then
    if exists (select 1 from public.acreditados_cda where recinto_codigo = p_recinto_codigo and tipo = 'titular') then
      raise exception 'Este recinto ya tiene un acreditado CDA titular. Desvincúlelo primero.';
    end if;
    v_orden := 0;
  else
    select coalesce(max(orden), 0) + 1 into v_orden
      from public.acreditados_cda where recinto_codigo = p_recinto_codigo and tipo = 'suplente';
  end if;

  insert into public.acreditados_cda (cedula, nombres, telefono, recinto_codigo, parroquia_codigo, tipo, orden)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_acreditado_cda', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;

create or replace function public.desvincular_acreditado_cda(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acreditado public.acreditados_cda;
  v_siguiente public.acreditados_cda;
begin
  select * into v_acreditado from public.acreditados_cda where id = p_id;
  if not found then
    raise exception 'No se encontró el acreditado CDA.';
  end if;

  delete from public.acreditados_cda where id = p_id;

  if v_acreditado.tipo = 'titular' then
    select * into v_siguiente from public.acreditados_cda
      where recinto_codigo = v_acreditado.recinto_codigo and tipo = 'suplente'
      order by orden asc limit 1;
    if found then
      update public.acreditados_cda set tipo = 'titular', orden = 0 where id = v_siguiente.id;
      update public.acreditados_cda set orden = orden - 1
        where recinto_codigo = v_acreditado.recinto_codigo and tipo = 'suplente' and orden > v_siguiente.orden;
    end if;
  else
    update public.acreditados_cda set orden = orden - 1
      where recinto_codigo = v_acreditado.recinto_codigo and tipo = 'suplente' and orden > v_acreditado.orden;
  end if;

  insert into public.lista_negra (cedula, nombres, telefono, motivo, origen)
  values (v_acreditado.cedula, v_acreditado.nombres, v_acreditado.telefono, p_motivo, 'acreditado_cda')
  on conflict (cedula) do update set
    nombres = excluded.nombres,
    telefono = excluded.telefono,
    motivo = excluded.motivo,
    origen = excluded.origen;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_acreditado_cda', v_acreditado.cedula, v_acreditado.recinto_codigo, v_acreditado.parroquia_codigo, current_date);
end;
$$;

revoke execute on function public.agregar_acreditado_cda(text, text, text, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.desvincular_acreditado_cda(uuid, text) from public, anon, authenticated;

grant execute on function public.agregar_acreditado_cda(text, text, text, integer, integer, text) to service_role;
grant execute on function public.desvincular_acreditado_cda(uuid, text) to service_role;
