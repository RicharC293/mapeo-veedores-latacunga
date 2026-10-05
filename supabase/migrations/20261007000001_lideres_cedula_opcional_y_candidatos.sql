-- 1) La cédula de un líder deja de ser obligatoria: es un rol puramente
-- organizativo (no entra al proceso electoral ni a la lista negra), así que
-- no hay una razón de control que la justifique como requisito. El índice
-- único (lideres_cedula_unica) sigue aplicando entre cédulas no nulas:
-- Postgres no considera NULL = NULL para unicidad, así que varios líderes
-- sin cédula conviven sin problema.
--
-- 2) Nuevo ámbito "candidato": persona que todavía no es líder de una
-- parroquia ni líder general. Se guarda sin parroquia y después se le eligen
-- las parroquias de las que es responsable (una o varias, en
-- parroquia_codigos). Un candidato no tiene cargo (la dignidad electa es de
-- quien ya la ostenta) ni parroquia_codigo; los demás ámbitos no usan la
-- lista.

alter table public.lideres alter column cedula drop not null;

-- Los checks de cédula y ámbito se crearon sin nombre explícito (Postgres
-- los nombra "<tabla>_<columna>_check"), así que se buscan dinámicamente en
-- vez de asumir ese nombre (mismo patrón que la migración de
-- acreditados_cda). El de ámbito también atrapa
-- lideres_parroquia_segun_ambito, que referencia esa columna y se vuelve a
-- crear más abajo con la regla nueva.
do $$
declare
  r record;
begin
  for r in
    select distinct con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'lideres'
      and att.attname in ('cedula', 'ambito')
      and con.contype = 'c'
  loop
    execute format('alter table public.lideres drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.lideres add column parroquia_codigos integer[] not null default '{}';

alter table public.lideres
  add constraint lideres_cedula_check
  check (cedula is null or cedula ~ '^[0-9]{10}$');

alter table public.lideres
  add constraint lideres_ambito_check
  check (ambito in ('general', 'parroquia', 'candidato'));

alter table public.lideres
  add constraint lideres_parroquia_segun_ambito check (
    (ambito = 'general' and parroquia_codigo is null and parroquia_codigos = '{}')
    or (ambito = 'parroquia' and parroquia_codigo is not null and parroquia_codigos = '{}')
    or (ambito = 'candidato' and parroquia_codigo is null and cargo is null)
  );
