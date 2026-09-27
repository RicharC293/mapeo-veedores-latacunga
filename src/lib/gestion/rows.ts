// Traduce filas de Supabase (snake_case) a los tipos de dominio (camelCase).

import type {
  AcreditadoCda,
  AmbitoLider,
  Coordinador,
  Lider,
  ListaNegraEntry,
  OrigenListaNegra,
  TipoAsignacion,
  Veedor,
} from "./types";

export function rowToVeedor(row: Record<string, unknown>): Veedor {
  return {
    id: row.id as string,
    cedula: row.cedula as string,
    nombres: row.nombres as string,
    telefono: row.telefono as string,
    juntaId: row.junta_id as string,
    recintoCodigo: row.recinto_codigo as number,
    parroquiaCodigo: row.parroquia_codigo as number,
    tipo: row.tipo as TipoAsignacion,
    orden: row.orden as number,
    verificado: Boolean(row.verificado),
    creadoEn: row.creado_en as string,
  };
}

export function rowToCoordinador(row: Record<string, unknown>): Coordinador {
  return {
    id: row.id as string,
    cedula: row.cedula as string,
    nombres: row.nombres as string,
    telefono: row.telefono as string,
    recintoCodigo: row.recinto_codigo as number,
    parroquiaCodigo: row.parroquia_codigo as number,
    tipo: row.tipo as TipoAsignacion,
    orden: row.orden as number,
    verificado: Boolean(row.verificado),
    creadoEn: row.creado_en as string,
  };
}

export function rowToAcreditadoCda(
  row: Record<string, unknown>,
): AcreditadoCda {
  return {
    id: row.id as string,
    cedula: row.cedula as string,
    nombres: row.nombres as string,
    telefono: row.telefono as string,
    recintoCodigo: row.recinto_codigo as number,
    parroquiaCodigo: row.parroquia_codigo as number,
    tipo: row.tipo as TipoAsignacion,
    orden: row.orden as number,
    verificado: Boolean(row.verificado),
    creadoEn: row.creado_en as string,
  };
}

export function rowToLider(row: Record<string, unknown>): Lider {
  return {
    id: row.id as string,
    cedula: row.cedula as string,
    nombres: row.nombres as string,
    telefono: row.telefono as string,
    organizacion: (row.organizacion as string | null) ?? "",
    ambito: row.ambito as AmbitoLider,
    parroquiaCodigo: (row.parroquia_codigo as number | null) ?? null,
    recintoCodigos: (row.recinto_codigos as number[] | null) ?? [],
    creadoEn: row.creado_en as string,
  };
}

export function rowToListaNegra(row: Record<string, unknown>): ListaNegraEntry {
  return {
    id: row.id as string,
    cedula: row.cedula as string,
    nombres: row.nombres as string,
    telefono: row.telefono as string,
    motivo: (row.motivo as string | null) ?? null,
    origen: row.origen as OrigenListaNegra,
    creadoEn: row.creado_en as string,
  };
}
