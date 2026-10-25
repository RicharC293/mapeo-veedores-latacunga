-- Datos útiles de la respuesta del Registro Civil en columnas propias (para
-- filtrar y contar sin leer el JSON), y la decisión de mantener el nombre del
-- sistema cuando difiere del oficial. Se guarda la fecha de nacimiento y no
-- la edad, para que la edad se calcule siempre al día.
alter table public.validaciones_cedula
  add column fecha_nacimiento date,
  add column genero text,
  add column nombre_mantenido boolean not null default false;

-- Llena las columnas nuevas con lo que ya trae el JSON guardado.
update public.validaciones_cedula
set
  fecha_nacimiento = nullif(respuesta -> 'data' ->> 'birth_date', '')::date,
  genero = nullif(respuesta -> 'data' ->> 'gender', '')
where estado = 'validada'
  and respuesta -> 'data' is not null;
