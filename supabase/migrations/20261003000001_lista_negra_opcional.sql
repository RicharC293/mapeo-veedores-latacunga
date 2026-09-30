-- Al desvincular un veedor/coordinador/acreditado CDA, quien gestiona decide
-- si esa cédula pasa a la lista negra (comportamiento por defecto, igual que
-- antes) o si solo se retira sin marcarla (por ejemplo, alguien que ni
-- siquiera constaba en el padrón).

drop function if exists public.desvincular_veedor(uuid, text);
drop function if exists public.desvincular_coordinador(uuid, text);
drop function if exists public.desvincular_acreditado_cda(uuid, text);

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
  end if;

  insert into public.eventos_actividad (tipo, cedula, recinto_codigo, parroquia_codigo, fecha)
  values ('baja_acreditado_cda', v_acreditado.cedula, v_acreditado.recinto_codigo, v_acreditado.parroquia_codigo, current_date);
end;
$$;

revoke execute on function public.desvincular_veedor(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.desvincular_coordinador(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.desvincular_acreditado_cda(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.desvincular_veedor(uuid, text, boolean) to service_role;
grant execute on function public.desvincular_coordinador(uuid, text, boolean) to service_role;
grant execute on function public.desvincular_acreditado_cda(uuid, text, boolean) to service_role;
