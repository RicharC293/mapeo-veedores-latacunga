-- "Preferencia": recinto que la persona dice poder cubrir, tal como llegó en
-- el dato original (texto libre). Solo existe en Militancia: sirve de
-- referencia al asignar, no se copia a veedores/coordinadores/CDA. Cuando el
-- texto se reconoce como un recinto único, la importación además precarga
-- recinto_codigo/parroquia_codigo (eso es independiente de este campo).

alter table public.militantes add column preferencia text not null default '';
