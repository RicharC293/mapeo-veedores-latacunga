-- Funciones auxiliares para scripts/seed-supabase.ts. Reciben GeoJSON como
-- texto y hacen el cast a PostGIS del lado del servidor, evitando depender
-- de una conexión Postgres directa: todo pasa por la API de Supabase con
-- la clave service_role.

create or replace function public.activar_corte(
  p_fecha_corte date,
  p_fuente text,
  p_archivo text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  update public.distributivo_cortes set activo = false where activo = true;

  select id into v_id from public.distributivo_cortes where fecha_corte = p_fecha_corte;
  if v_id is null then
    insert into public.distributivo_cortes (fecha_corte, fuente, archivo, activo)
    values (p_fecha_corte, p_fuente, p_archivo, true)
    returning id into v_id;
  else
    update public.distributivo_cortes
      set fuente = p_fuente, archivo = p_archivo, activo = true
      where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.cargar_parroquia(
  p_codigo integer,
  p_canton_codigo integer,
  p_nombre text,
  p_urbana boolean,
  p_geojson text,
  p_lx double precision,
  p_ly double precision
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.parroquias (codigo, canton_codigo, nombre, urbana, geom, etiqueta)
  values (
    p_codigo, p_canton_codigo, p_nombre, p_urbana,
    st_multi(st_setsrid(st_geomfromgeojson(p_geojson), 4326)),
    st_setsrid(st_makepoint(p_lx, p_ly), 4326)
  )
  on conflict (codigo) do update set
    canton_codigo = excluded.canton_codigo,
    nombre = excluded.nombre,
    urbana = excluded.urbana,
    geom = excluded.geom,
    etiqueta = excluded.etiqueta;
end;
$$;

create or replace function public.cargar_canton_base(
  p_canton_codigo integer,
  p_geojson text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.canton_base (canton_codigo, geom)
  values (p_canton_codigo, st_multi(st_setsrid(st_geomfromgeojson(p_geojson), 4326)))
  on conflict (canton_codigo) do update set geom = excluded.geom;
end;
$$;

create or replace function public.cargar_recinto(
  p_codigo_cne integer,
  p_corte_id bigint,
  p_parroquia_codigo integer,
  p_nombre text,
  p_direccion text,
  p_telefono text,
  p_zona text,
  p_cda boolean,
  p_jun_fem integer,
  p_jun_mas integer,
  p_total_juntas integer,
  p_fem_ini integer,
  p_fem_fin integer,
  p_mas_ini integer,
  p_mas_fin integer,
  p_electores integer,
  p_dificil_acceso boolean,
  p_sin_conectividad boolean,
  p_lon double precision,
  p_lat double precision
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.recintos (
    codigo_cne, corte_id, parroquia_codigo, nombre, direccion, telefono, zona, cda,
    jun_fem, jun_mas, total_juntas, fem_ini, fem_fin, mas_ini, mas_fin, electores,
    dificil_acceso, sin_conectividad, geom
  ) values (
    p_codigo_cne, p_corte_id, p_parroquia_codigo, p_nombre, p_direccion, p_telefono,
    nullif(p_zona, ''), p_cda, p_jun_fem, p_jun_mas, p_total_juntas, p_fem_ini, p_fem_fin,
    p_mas_ini, p_mas_fin, p_electores, p_dificil_acceso, p_sin_conectividad,
    st_setsrid(st_makepoint(p_lon, p_lat), 4326)
  )
  on conflict (codigo_cne, corte_id) do update set
    parroquia_codigo = excluded.parroquia_codigo,
    nombre = excluded.nombre,
    direccion = excluded.direccion,
    telefono = excluded.telefono,
    zona = excluded.zona,
    cda = excluded.cda,
    jun_fem = excluded.jun_fem,
    jun_mas = excluded.jun_mas,
    total_juntas = excluded.total_juntas,
    fem_ini = excluded.fem_ini,
    fem_fin = excluded.fem_fin,
    mas_ini = excluded.mas_ini,
    mas_fin = excluded.mas_fin,
    electores = excluded.electores,
    dificil_acceso = excluded.dificil_acceso,
    sin_conectividad = excluded.sin_conectividad,
    geom = excluded.geom;
end;
$$;

revoke execute on function public.activar_corte(date, text, text) from public, anon, authenticated;
revoke execute on function public.cargar_parroquia(integer, integer, text, boolean, text, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.cargar_canton_base(integer, text) from public, anon, authenticated;
revoke execute on function public.cargar_recinto(integer, bigint, integer, text, text, text, text, boolean, integer, integer, integer, integer, integer, integer, integer, integer, boolean, boolean, double precision, double precision) from public, anon, authenticated;

grant execute on function public.activar_corte(date, text, text) to service_role;
grant execute on function public.cargar_parroquia(integer, integer, text, boolean, text, double precision, double precision) to service_role;
grant execute on function public.cargar_canton_base(integer, text) to service_role;
grant execute on function public.cargar_recinto(integer, bigint, integer, text, text, text, text, boolean, integer, integer, integer, integer, integer, integer, integer, integer, boolean, boolean, double precision, double precision) to service_role;
