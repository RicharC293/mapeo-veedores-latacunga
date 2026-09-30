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
  responsableLiderId: string | null;
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
  responsableLiderId: string | null;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: TipoAsignacion;
  orden: number;
  verificado: boolean;
  creadoEn: string;
}

// Persona acreditada por el CNE para el Centro de Digitalización de Actas
// (CDA) de un recinto. Solo aplica a recintos con cda = true, y es un rol
// distinto del coordinador de recinto (otra persona, otra responsabilidad).
export interface AcreditadoCda {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  responsableLiderId: string | null;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: TipoAsignacion;
  orden: number;
  verificado: boolean;
  creadoEn: string;
}

export type AmbitoLider = "general" | "parroquia";

// Dignidad electa que puede ostentar un líder, además de su rol
// organizativo (ambito). Un concejal o el alcalde son líderes con cargo.
export type Cargo =
  | "alcalde"
  | "concejal_urbano"
  | "concejal_rural"
  | "vocal_junta_parroquial";

export const CUPO_CARGO: Record<Cargo, number> = {
  alcalde: 1,
  concejal_urbano: 6,
  concejal_rural: 5,
  // Es 1 por cada parroquia rural, no un cupo cantonal plano.
  vocal_junta_parroquial: 1,
};

export const CARGO_LABEL: Record<Cargo, string> = {
  alcalde: "Alcalde",
  concejal_urbano: "Concejal urbano",
  concejal_rural: "Concejal rural",
  vocal_junta_parroquial: "Vocal de junta parroquial",
};

export interface Lider {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  organizacion: string;
  ambito: AmbitoLider;
  parroquiaCodigo: number | null;
  recintoCodigos: number[];
  cargo: Cargo | null;
  foto: string | null;
  creadoEn: string;
}

export type OrigenListaNegra =
  "veedor" | "coordinador" | "acreditado_cda" | "manual";

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
  | "alta_veedor"
  | "baja_veedor"
  | "alta_coordinador"
  | "baja_coordinador"
  | "alta_acreditado_cda"
  | "baja_acreditado_cda";

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
  // Igual que juntasCubiertas/pct, pero exige además que tanto el veedor
  // como el coordinador titulares ya hayan sido verificados (contactados).
  juntasCubiertasVerificado: number;
  tieneCoordinadorVerificado: boolean;
  pctVerificado: number;
  // Progreso informativo, independiente entre sí (a diferencia de "pct" arriba,
  // que exige veedor Y coordinador para contar una junta como cubierta).
  // pct* = % con titular asignado; pct*Verificado = % (sobre el mismo total)
  // cuyo titular ya fue contactado.
  pctVeedores: number;
  pctVeedoresVerificado: number;
  pctCoordinador: number;
  pctCoordinadorVerificado: number;
  // Acreditación CDA: solo aplica cuando el recinto es un Centro de
  // Digitalización de Actas (cdaAplica = r.cda). Si no aplica, pctCda y
  // pctCdaVerificado quedan en 0 y no deben mostrarse.
  cdaAplica: boolean;
  tieneCdaTitular: boolean;
  tieneCdaVerificado: boolean;
  pctCda: number;
  pctCdaVerificado: number;
}

export interface CoberturaParroquia {
  parroquiaCodigo: number;
  totalJuntas: number;
  juntasConVeedor: number;
  juntasConVeedorVerificado: number;
  pctVeedores: number;
  pctVeedoresVerificado: number;
  totalRecintos: number;
  recintosConCoordinador: number;
  recintosConCoordinadorVerificado: number;
  pctCoordinador: number;
  pctCoordinadorVerificado: number;
  // Igual que arriba, pero contado solo sobre los recintos CDA de la
  // parroquia (totalRecintosCda puede ser 0 si no tiene ninguno).
  totalRecintosCda: number;
  recintosConCda: number;
  recintosConCdaVerificado: number;
  pctCda: number;
  pctCdaVerificado: number;
}
