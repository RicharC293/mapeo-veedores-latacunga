-- "Responsable" pasa de texto libre a una referencia real a un líder: así un
-- futuro reporte de aporte por responsable puede agrupar de forma exacta
-- (sin duplicar por typos/mayúsculas) y, si se corrige el nombre de un
-- líder, se refleja en todo lo que ya tenía asignado. Se parte limpio: no
-- hay datos reales en el campo anterior que preservar.

alter table public.veedores drop column responsable;
alter table public.coordinadores drop column responsable;
alter table public.acreditados_cda drop column responsable;

alter table public.veedores
  add column responsable_lider_id uuid references public.lideres (id) on delete set null;
alter table public.coordinadores
  add column responsable_lider_id uuid references public.lideres (id) on delete set null;
alter table public.acreditados_cda
  add column responsable_lider_id uuid references public.lideres (id) on delete set null;

create index veedores_responsable_lider_idx on public.veedores (responsable_lider_id);
create index coordinadores_responsable_lider_idx on public.coordinadores (responsable_lider_id);
create index acreditados_cda_responsable_lider_idx on public.acreditados_cda (responsable_lider_id);

-- Las funciones agregar_* cambian de firma (el parámetro pasa de text a
-- uuid), así que hay que eliminar las versiones anteriores antes de crear
-- las nuevas.
drop function if exists public.agregar_veedor(text, text, text, text, integer, integer, text, text);
drop function if exists public.agregar_coordinador(text, text, text, integer, integer, text, text);
drop function if exists public.agregar_acreditado_cda(text, text, text, integer, integer, text, text);

create or replace function public.agregar_veedor(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_junta_id text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text,
  p_responsable_lider_id uuid default null
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

  insert into public.veedores (cedula, nombres, telefono, junta_id, recinto_codigo, parroquia_codigo, tipo, orden, responsable_lider_id)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), p_junta_id, p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden, p_responsable_lider_id)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_veedor', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;

create or replace function public.agregar_coordinador(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text,
  p_responsable_lider_id uuid default null
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

  insert into public.coordinadores (cedula, nombres, telefono, recinto_codigo, parroquia_codigo, tipo, orden, responsable_lider_id)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden, p_responsable_lider_id)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_coordinador', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;

create or replace function public.agregar_acreditado_cda(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text,
  p_responsable_lider_id uuid default null
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

  insert into public.acreditados_cda (cedula, nombres, telefono, recinto_codigo, parroquia_codigo, tipo, orden, responsable_lider_id)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden, p_responsable_lider_id)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_acreditado_cda', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;

revoke execute on function public.agregar_veedor(text, text, text, text, integer, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.agregar_coordinador(text, text, text, integer, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.agregar_acreditado_cda(text, text, text, integer, integer, text, uuid) from public, anon, authenticated;

grant execute on function public.agregar_veedor(text, text, text, text, integer, integer, text, uuid) to service_role;
grant execute on function public.agregar_coordinador(text, text, text, integer, integer, text, uuid) to service_role;
grant execute on function public.agregar_acreditado_cda(text, text, text, integer, integer, text, uuid) to service_role;
