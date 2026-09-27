export type Genero = "F" | "M";

export interface Junta {
  id: string;
  recintoCodigo: number;
  genero: Genero;
  numero: number;
}

export type TipoAsignacion = "titular" | "suplente";

export interface Veedor {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  juntaId: string;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: TipoAsignacion;
  orden: number;
  verificado: boolean;
  creadoEn: string;
}

export interface Coordinador {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: TipoAsignacion;
  orden: number;
  verificado: boolean;
  creadoEn: string;
}

export type AmbitoLider = "general" | "parroquia";

export interface Lider {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  ambito: AmbitoLider;
  parroquiaCodigo: number | null;
  recintoCodigos: number[];
  creadoEn: string;
}

export type OrigenListaNegra = "veedor" | "coordinador" | "manual";

export interface ListaNegraEntry {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  motivo: string | null;
  origen: OrigenListaNegra;
  creadoEn: string;
}

export type TipoEvento =
  "alta_veedor" | "baja_veedor" | "alta_coordinador" | "baja_coordinador";

export interface EventoActividad {
  id: string;
  tipo: TipoEvento;
  cedula: string;
  recintoCodigo: number;
  parroquiaCodigo: number;
  fecha: string;
  creadoEn: string;
}

export interface CoberturaRecinto {
  recintoCodigo: number;
  parroquiaCodigo: number;
  totalJuntas: number;
  juntasCubiertas: number;
  tieneCoordinadorTitular: boolean;
  pct: number;
  // Progreso informativo, independiente entre sí (a diferencia de "pct" arriba,
  // que exige veedor Y coordinador para contar una junta como cubierta).
  pctVeedores: number;
  pctCoordinador: number;
}

export interface CoberturaParroquia {
  parroquiaCodigo: number;
  totalJuntas: number;
  juntasConVeedor: number;
  pctVeedores: number;
  totalRecintos: number;
  recintosConCoordinador: number;
  pctCoordinador: number;
}
