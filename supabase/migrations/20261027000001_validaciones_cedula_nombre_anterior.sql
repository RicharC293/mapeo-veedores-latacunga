-- Nombre que tenía la persona antes de aplicar el nombre oficial del Registro
-- Civil, para poder deshacerlo (por ejemplo, si la cédula estaba mal digitada
-- y el nombre oficial es de otra persona).
alter table public.validaciones_cedula
  add column nombre_anterior text,
  add column nombre_aplicado_en timestamptz;
