-- Dignidades electas (alcalde, concejales, vocales de junta parroquial):
-- un líder puede tener un "cargo" además de su rol organizativo (ambito).
-- También se agrega "foto" para el diagrama de estructura organizativa.

alter table public.lideres add column cargo text
  check (cargo in ('alcalde', 'concejal_urbano', 'concejal_rural', 'vocal_junta_parroquial'));
alter table public.lideres add column foto text;

-- Cupos: "máx. 1 alcalde" y "máx. 1 vocal por parroquia" podrían resolverse
-- con índices únicos parciales, pero "máx. 6 concejales urbanos" y "máx. 5
-- rurales" son topes por conteo, que Postgres no expresa con constraints
-- declarativos. Se usa un solo trigger que cubre los cuatro casos.
create or replace function public.validar_cargo_lider()
returns trigger
language plpgsql
as $$
declare
  v_conteo integer;
begin
  if new.cargo is null then
    return new;
  end if;

  if new.cargo = 'alcalde' then
    select count(*) into v_conteo from public.lideres
      where cargo = 'alcalde' and id <> new.id;
    if v_conteo >= 1 then
      raise exception 'Ya existe un alcalde registrado.';
    end if;
  elsif new.cargo = 'concejal_urbano' then
    select count(*) into v_conteo from public.lideres
      where cargo = 'concejal_urbano' and id <> new.id;
    if v_conteo >= 6 then
      raise exception 'Ya se alcanzó el máximo de 6 concejales urbanos.';
    end if;
  elsif new.cargo = 'concejal_rural' then
    select count(*) into v_conteo from public.lideres
      where cargo = 'concejal_rural' and id <> new.id;
    if v_conteo >= 5 then
      raise exception 'Ya se alcanzó el máximo de 5 concejales rurales.';
    end if;
  elsif new.cargo = 'vocal_junta_parroquial' then
    if new.parroquia_codigo is null then
      raise exception 'Debe indicar la parroquia del vocal.';
    end if;
    select count(*) into v_conteo from public.lideres
      where cargo = 'vocal_junta_parroquial'
        and parroquia_codigo = new.parroquia_codigo and id <> new.id;
    if v_conteo >= 1 then
      raise exception 'Esta parroquia ya tiene un vocal asignado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lideres_validar_cargo on public.lideres;
create trigger lideres_validar_cargo
  before insert or update on public.lideres
  for each row execute function public.validar_cargo_lider();

-- Bucket de fotos: público de lectura (se sirven por URL pública desde el
-- diagrama), pero solo el servidor sube archivos con supabaseSecret
-- (service_role salta RLS de storage, así que no hace falta una policy).
insert into storage.buckets (id, name, public)
values ('lideres-fotos', 'lideres-fotos', true)
on conflict (id) do nothing;
