-- Marca si ya se contactó al veedor/coordinador (independiente de si es
-- titular o suplente, y no afecta el cálculo de cobertura por junta/recinto).
alter table public.veedores add column verificado boolean not null default false;
alter table public.coordinadores add column verificado boolean not null default false;
