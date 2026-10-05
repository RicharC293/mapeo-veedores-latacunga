-- Ámbito de liderazgo y cargo (dignidad) pasan a ser dos ejes independientes:
--
--  * cargo: la dignidad a la que postula la persona (alcalde, concejal,
--    vocal). "Candidato" es simplemente quien tiene un cargo; no es un ámbito.
--  * ambito: el ámbito de liderazgo, opcional: NULL (ninguno), 'general'
--    (todo el cantón) o 'parroquia' (una o varias parroquias, en
--    parroquia_codigos). Se elige solo cuando la persona realmente lidera.
--  * parroquia_codigo (escalar) queda reservado para el vocal: la parroquia
--    de su junta parroquial. Ya no es la parroquia del líder.
--
-- Reemplaza el ámbito 'candidato' de la migración anterior.

alter table public.lideres alter column ambito drop not null;

-- Se buscan dinámicamente los checks que referencian "ambito" (el de valores
-- permitidos y lideres_parroquia_segun_ambito, que también cita esa columna)
-- en vez de asumir sus nombres.
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
      and att.attname = 'ambito'
      and con.contype = 'c'
  loop
    execute format('alter table public.lideres drop constraint %I', r.conname);
  end loop;
end $$;

-- Conversión de datos existentes al modelo nuevo (en producción no hay
-- líderes todavía; esto solo cubre otros entornos).
-- 1) Un candidato con parroquias pasa a líder de parroquia; sin ellas, a
--    ámbito ninguno.
update public.lideres set ambito = 'parroquia'
  where ambito = 'candidato' and cardinality(parroquia_codigos) > 0;
update public.lideres set ambito = null where ambito = 'candidato';
-- 2) La parroquia única del antiguo líder de parroquia pasa a la lista.
update public.lideres set parroquia_codigos = array[parroquia_codigo]
  where ambito = 'parroquia'
    and cardinality(parroquia_codigos) = 0
    and parroquia_codigo is not null;
-- 3) parroquia_codigo solo se conserva para el vocal.
update public.lideres set parroquia_codigo = null
  where parroquia_codigo is not null
    and coalesce(cargo = 'vocal_junta_parroquial', false) = false;
-- 4) Sin ámbito no hay parroquias ni recintos a cargo.
update public.lideres set parroquia_codigos = '{}', recinto_codigos = '{}'
  where ambito is null;
update public.lideres set parroquia_codigos = '{}' where ambito = 'general';

alter table public.lideres
  add constraint lideres_ambito_check
  check (ambito is null or ambito in ('general', 'parroquia'));

alter table public.lideres
  add constraint lideres_parroquias_segun_ambito check (
    (ambito is null and parroquia_codigos = '{}' and recinto_codigos = '{}')
    or (ambito = 'general' and parroquia_codigos = '{}')
    or (ambito = 'parroquia' and cardinality(parroquia_codigos) >= 1)
  );

alter table public.lideres
  add constraint lideres_parroquia_solo_vocal check (
    coalesce(cargo = 'vocal_junta_parroquial', false) = (parroquia_codigo is not null)
  );
