-- Organización a la que pertenece el líder (campo libre, opcional).
alter table public.lideres add column organizacion text not null default '';
