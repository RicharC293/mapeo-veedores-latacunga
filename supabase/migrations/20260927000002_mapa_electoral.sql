-- Esquema del mapa electoral: cortes del distributivo, parroquias, la base
-- del cantón y los recintos. Réplica en Postgres/PostGIS de data/seed/*.

create table public.distributivo_cortes (
  id bigint generated always as identity primary key,
  fecha_corte date not null,
  fuente text,
  archivo text,
  activo boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Solo puede haber un corte activo a la vez.
create unique index distributivo_cortes_unico_activo
  on public.distributivo_cortes (activo)
  where activo;

create table public.parroquias (
  codigo integer primary key,
  canton_codigo integer not null,
  nombre text not null,
  nombre_corto text,
  urbana boolean not null default false,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  etiqueta extensions.geometry(Point, 4326) not null
);

create index parroquias_geom_idx on public.parroquias using gist (geom);
create index parroquias_canton_idx on public.parroquias (canton_codigo);

create table public.canton_base (
  canton_codigo integer primary key,
  geom extensions.geometry(MultiPolygon, 4326) not null
);

create index canton_base_geom_idx on public.canton_base using gist (geom);

create table public.recintos (
  codigo_cne integer not null,
  corte_id bigint not null references public.distributivo_cortes (id) on delete cascade,
  parroquia_codigo integer not null references public.parroquias (codigo),
  nombre text not null,
  direccion text,
  telefono text,
  zona text,
  cda boolean not null default false,
  jun_fem integer not null default 0,
  jun_mas integer not null default 0,
  total_juntas integer not null default 0,
  fem_ini integer,
  fem_fin integer,
  mas_ini integer,
  mas_fin integer,
  electores integer not null default 0,
  dificil_acceso boolean not null default false,
  sin_conectividad boolean not null default false,
  geom extensions.geometry(Point, 4326) not null,
  visible boolean not null default true,
  nota text,
  actualizado_en timestamptz not null default now(),
  primary key (codigo_cne, corte_id)
);

create index recintos_geom_idx on public.recintos using gist (geom);
create index recintos_parroquia_idx on public.recintos (parroquia_codigo);
create index recintos_corte_idx on public.recintos (corte_id);

create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger recintos_actualizado_en
  before update on public.recintos
  for each row
  execute function public.set_actualizado_en();

-- Devuelve el mapa completo de un cantón en el mismo formato que
-- consume el frontend (GeoJSON + arreglo de recintos + resumen).
create or replace function public.get_mapa(canton int)
returns json
language sql
stable
set search_path = public, extensions
as $$
  select json_build_object(
    'parroquias', (
      select json_build_object(
        'type', 'FeatureCollection',
        'features', coalesce(json_agg(
          json_build_object(
            'type', 'Feature',
            'properties', json_build_object(
              'code', p.codigo,
              'name', p.nombre,
              'urbana', p.urbana,
              'lx', st_x(p.etiqueta),
              'ly', st_y(p.etiqueta)
            ),
            'geometry', st_asgeojson(p.geom, 5)::json
          )
        ), '[]'::json)
      )
      from public.parroquias p
      where p.canton_codigo = canton
    ),
    'base', (
      select json_build_object(
        'type', 'Feature',
        'properties', json_build_object(),
        'geometry', st_asgeojson(cb.geom, 5)::json
      )
      from public.canton_base cb
      where cb.canton_codigo = canton
    ),
    'recintos', (
      select coalesce(json_agg(
        json_build_object(
          'cod', r.codigo_cne,
          'par', r.parroquia_codigo,
          'nombre', r.nombre,
          'dir', r.direccion,
          'tel', r.telefono,
          'cda', r.cda,
          'jf', r.jun_fem,
          'jm', r.jun_mas,
          'jt', r.total_juntas,
          'fi', r.fem_ini,
          'ff', r.fem_fin,
          'mi', r.mas_ini,
          'mf', r.mas_fin,
          'el', r.electores,
          'lon', st_x(r.geom),
          'lat', st_y(r.geom),
          'dif', r.dificil_acceso,
          'sinc', r.sin_conectividad,
          'zona', coalesce(r.zona, '')
        )
      ), '[]'::json)
      from public.recintos r
      join public.distributivo_cortes c on c.id = r.corte_id
      where r.parroquia_codigo in (select codigo from public.parroquias where canton_codigo = canton)
        and c.activo = true
        and r.visible = true
    ),
    'corte', (
      select to_char(c.fecha_corte, 'YYYY-MM-DD')
      from public.distributivo_cortes c
      where c.activo = true
      limit 1
    )
  );
$$;

grant execute on function public.get_mapa(int) to anon, authenticated;

alter table public.distributivo_cortes enable row level security;
alter table public.parroquias enable row level security;
alter table public.canton_base enable row level security;
alter table public.recintos enable row level security;

create policy "distributivo_cortes_lectura_publica"
  on public.distributivo_cortes for select
  using (true);

create policy "parroquias_lectura_publica"
  on public.parroquias for select
  using (true);

create policy "canton_base_lectura_publica"
  on public.canton_base for select
  using (true);

create policy "recintos_lectura_publica"
  on public.recintos for select
  using (
    visible = true
    and exists (
      select 1 from public.distributivo_cortes c
      where c.id = recintos.corte_id and c.activo = true
    )
  );

-- Sin políticas de escritura para anon/authenticated: por ahora solo
-- scripts locales con la clave service_role pueden insertar o modificar.
-- La Fase 5 (panel de administración con Supabase Auth) sumará una
-- política de escritura para un rol autenticado "admin".
