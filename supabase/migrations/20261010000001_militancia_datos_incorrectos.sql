-- Militancia ahora carga los datos tal como vienen y marca como "Incorrecto"
-- (en la interfaz) cualquier cédula, teléfono o correo mal formado, en vez de
-- rechazar la fila. Por eso la cédula ya no puede exigirse de 10 dígitos a
-- nivel de tabla: la validación vive en la aplicación y bloquea la
-- asignación mientras la fila siga incorrecta.

alter table public.militantes drop constraint if exists militantes_cedula_check;
