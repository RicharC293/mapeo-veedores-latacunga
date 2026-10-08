-- La preferencia (recinto que la persona dice poder cubrir) ahora se conserva
-- al asignar desde Militancia: veedores, coordinadores y acreditados CDA la
-- guardan para poder verla de un vistazo, y si la persona regresa a
-- Militancia al desvincularse, la preferencia vuelve con ella.
-- Las funciones agregar_* ganan un parámetro (cambia su firma: se eliminan las
-- anteriores); las desvincular_* conservan la firma.

alter table public.veedores add column preferencia text not null default '';
alter table public.coordinadores add column preferencia text not null default '';
alter table public.acreditados_cda add column preferencia text not null default '';

drop function if exists public.agregar_veedor(text, text, text, text, integer, integer, text, uuid, text);
drop function if exists public.agregar_coordinador(text, text, text, integer, integer, text, uuid, text);
drop function if exists public.agregar_acreditado_cda(text, text, text, integer, integer, text, uuid, text);

create or replace function public.agregar_veedor(
  p_cedula text,
  p_nombres text,
  p_telefono text,
  p_junta_id text,
  p_recinto_codigo integer,
  p_parroquia_codigo integer,
  p_tipo text,
  p_responsable_lider_id uuid default null,
  p_email text default '',
  p_preferencia text default ''
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

  insert into public.veedores (cedula, nombres, telefono, email, preferencia, junta_id, recinto_codigo, parroquia_codigo, tipo, orden, responsable_lider_id)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), trim(coalesce(p_email, '')), trim(coalesce(p_preferencia, '')), p_junta_id, p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden, p_responsable_lider_id)
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
  p_responsable_lider_id uuid default null,
  p_email text default '',
  p_preferencia text default ''
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

  insert into public.coordinadores (cedula, nombres, telefono, email, preferencia, recinto_codigo, parroquia_codigo, tipo, orden, responsable_lider_id)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), trim(coalesce(p_email, '')), trim(coalesce(p_preferencia, '')), p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden, p_responsable_lider_id)
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
  p_responsable_lider_id uuid default null,
  p_email text default '',
  p_preferencia text default ''
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

  insert into public.acreditados_cda (cedula, nombres, telefono, email, preferencia, recinto_codigo, parroquia_codigo, tipo, orden, responsable_lider_id)
  values (p_cedula, trim(p_nombres), trim(coalesce(p_telefono, '')), trim(coalesce(p_email, '')), trim(coalesce(p_preferencia, '')), p_recinto_codigo, p_parroquia_codigo, p_tipo, v_orden, p_responsable_lider_id)
  returning * into v_row;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('alta_acreditado_cda', p_cedula, p_recinto_codigo, p_parroquia_codigo, current_date);

  return v_row;
end;
$$;


create or replace function public.desvincular_veedor(
  p_id uuid,
  p_motivo text,
  p_lista_negra boolean default true
)
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

  if p_lista_negra then
    insert into public.lista_negra (cedula, nombres, telefono, motivo, origen)
    values (v_veedor.cedula, v_veedor.nombres, v_veedor.telefono, p_motivo, 'veedor')
    on conflict (cedula) do update set
      nombres = excluded.nombres,
      telefono = excluded.telefono,
      motivo = excluded.motivo,
      origen = excluded.origen;
  else
    -- Sin lista negra la persona no queda vetada: vuelve a la bandeja de
    -- Militancia, con el destino de donde salió, para poder asignarla de nuevo.
    insert into public.militantes (cedula, nombres, telefono, email, preferencia, responsable_lider_id, recinto_codigo, parroquia_codigo, tipo_preasignado, junta_preasignada)
    values (v_veedor.cedula, v_veedor.nombres, v_veedor.telefono, v_veedor.email, v_veedor.preferencia, v_veedor.responsable_lider_id, v_veedor.recinto_codigo, v_veedor.parroquia_codigo, 'veedor', v_veedor.junta_id);
  end if;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_veedor', v_veedor.cedula, v_veedor.recinto_codigo, v_veedor.parroquia_codigo, current_date);
end;
$$;

create or replace function public.desvincular_coordinador(
  p_id uuid,
  p_motivo text,
  p_lista_negra boolean default true
)
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

  if p_lista_negra then
    insert into public.lista_negra (cedula, nombres, telefono, motivo, origen)
    values (v_coordinador.cedula, v_coordinador.nombres, v_coordinador.telefono, p_motivo, 'coordinador')
    on conflict (cedula) do update set
      nombres = excluded.nombres,
      telefono = excluded.telefono,
      motivo = excluded.motivo,
      origen = excluded.origen;
  else
    -- Sin lista negra la persona no queda vetada: vuelve a la bandeja de
    -- Militancia, con el destino de donde salió, para poder asignarla de nuevo.
    insert into public.militantes (cedula, nombres, telefono, email, preferencia, responsable_lider_id, recinto_codigo, parroquia_codigo, tipo_preasignado)
    values (v_coordinador.cedula, v_coordinador.nombres, v_coordinador.telefono, v_coordinador.email, v_coordinador.preferencia, v_coordinador.responsable_lider_id, v_coordinador.recinto_codigo, v_coordinador.parroquia_codigo, 'coordinador');
  end if;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_coordinador', v_coordinador.cedula, v_coordinador.recinto_codigo, v_coordinador.parroquia_codigo, current_date);
end;
$$;

create or replace function public.desvincular_acreditado_cda(
  p_id uuid,
  p_motivo text,
  p_lista_negra boolean default true
)
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

  if p_lista_negra then
    insert into public.lista_negra (cedula, nombres, telefono, motivo, origen)
    values (v_acreditado.cedula, v_acreditado.nombres, v_acreditado.telefono, p_motivo, 'acreditado_cda')
    on conflict (cedula) do update set
      nombres = excluded.nombres,
      telefono = excluded.telefono,
      motivo = excluded.motivo,
      origen = excluded.origen;
  else
    -- Sin lista negra la persona no queda vetada: vuelve a la bandeja de
    -- Militancia, con el destino de donde salió, para poder asignarla de nuevo.
    insert into public.militantes (cedula, nombres, telefono, email, preferencia, responsable_lider_id, recinto_codigo, parroquia_codigo, tipo_preasignado)
    values (v_acreditado.cedula, v_acreditado.nombres, v_acreditado.telefono, v_acreditado.email, v_acreditado.preferencia, v_acreditado.responsable_lider_id, v_acreditado.recinto_codigo, v_acreditado.parroquia_codigo, 'cda');
  end if;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_acreditado_cda', v_acreditado.cedula, v_acreditado.recinto_codigo, v_acreditado.parroquia_codigo, current_date);
end;
$$;


revoke execute on function public.agregar_veedor(text, text, text, text, integer, integer, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.agregar_coordinador(text, text, text, integer, integer, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.agregar_acreditado_cda(text, text, text, integer, integer, text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.agregar_veedor(text, text, text, text, integer, integer, text, uuid, text, text) to service_role;
grant execute on function public.agregar_coordinador(text, text, text, integer, integer, text, uuid, text, text) to service_role;
grant execute on function public.agregar_acreditado_cda(text, text, text, integer, integer, text, uuid, text, text) to service_role;
