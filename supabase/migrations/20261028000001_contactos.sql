-- Contacto por WhatsApp (verificación 3): a quién ya se le escribió, quién
-- confirmó su participación y quién entregó la cédula para la acreditación.
-- Como la validación de identidad, se cuelga de la cédula y no del registro:
-- sobrevive a mover a la persona de junta, recinto o responsabilidad. Quien no
-- participa no queda aquí: se desvincula a la lista negra con el motivo.
create table public.contactos (
  cedula text primary key check (cedula ~ '^[0-9]{10}$'),
  -- enviado: se abrió el mensaje y se espera respuesta. confirmado: respondió
  -- que participa (además se marca verificado en su puesto).
  -- numero_equivocado: el celular no es suyo o no tiene WhatsApp.
  estado text not null check (estado in ('enviado', 'confirmado', 'numero_equivocado')),
  intentos integer not null default 0,
  ultimo_envio timestamptz,
  -- Puesto que decía el último mensaje (clase|tipo|recinto|junta): si la
  -- persona se mueve después, la pantalla avisa que hay que reenviarlo.
  puesto_enviado text,
  cedula_recibida boolean not null default false,
  actualizado_por text,
  actualizado_en timestamptz not null default now()
);

create index contactos_estado_idx on public.contactos (estado);

alter table public.contactos enable row level security;
-- Sin políticas: trae datos personales y solo se lee y escribe desde el
-- servidor con la clave secret, como el resto de gestión.
