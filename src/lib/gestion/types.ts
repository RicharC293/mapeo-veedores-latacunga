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
  email: string;
  // Recinto de preferencia con el que llegó desde Militancia (texto libre).
  preferencia: string;
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
  email: string;
  // Recinto de preferencia con el que llegó desde Militancia (texto libre).
  preferencia: string;
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
  email: string;
  // Recinto de preferencia con el que llegó desde Militancia (texto libre).
  preferencia: string;
  responsableLiderId: string | null;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: TipoAsignacion;
  orden: number;
  verificado: boolean;
  creadoEn: string;
}

// Ámbito de liderazgo. Es opcional (null = ninguno) y es independiente del
// cargo (dignidad): se elige solo cuando la persona realmente lidera, tenga
// o no una candidatura.
export type AmbitoLider = "general" | "parroquia";

// Dignidad electa que puede ostentar un líder, además de su rol
// organizativo (ambito). Un concejal o el alcalde son líderes con cargo.
export type Cargo =
  "alcalde" | "concejal_urbano" | "concejal_rural" | "vocal_junta_parroquial";

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
  // Rol puramente organizativo (no entra al proceso electoral ni a la lista
  // negra): la cédula es opcional, solo sirve para evitar duplicados.
  cedula: string | null;
  nombres: string;
  telefono: string;
  organizacion: string;
  // null = sin ámbito de liderazgo.
  ambito: AmbitoLider | null;
  // Solo para el vocal de junta parroquial: la parroquia de su junta.
  parroquiaCodigo: number | null;
  // Con ambito "parroquia": las parroquias a su cargo (una o varias).
  parroquiaCodigos: number[];
  recintoCodigos: number[];
  cargo: Cargo | null;
  foto: string | null;
  creadoEn: string;
}

// Persona con datos básicos cargada en "Militancia", pendiente de
// asignación como veedor, coordinador o acreditado CDA. recintoCodigo/
// parroquiaCodigo/tipoPreasignado son opcionales: los deja precargados una
// importación masiva que eligió destino para todo el lote, pero no asignan
// a la persona por sí solos (eso pasa al confirmar la fila en la UI).
export type TipoMilitancia = "veedor" | "coordinador" | "cda";

// Dónde consta ya una persona de Militancia.
export interface AsignacionExistente {
  tipo: TipoMilitancia;
  rol: TipoAsignacion;
  recintoCodigo: number;
  // Solo veedores: la junta (p. ej. "F9").
  junta: string | null;
}

export interface Militante {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  email: string;
  // Recinto de preferencia tal como llegó en el dato (texto libre).
  preferencia: string;
  responsableLiderId: string | null;
  recintoCodigo: number | null;
  parroquiaCodigo: number | null;
  tipoPreasignado: TipoMilitancia | null;
  // Mesa (junta) de origen de un veedor que regresó a Militancia al
  // desvincularse; solo preselecciona el desplegable de la fila.
  juntaPreasignada: string | null;
  creadoEn: string;
  // Cuántas veces se ha editado (calculado, de militantes_historial).
  ediciones: number;
  // Si esta cédula ya consta como veedor, coordinador o acreditado CDA
  // (calculado): la persona está "repetida y asignada" y no se vuelve a
  // asignar desde Militancia.
  asignado: AsignacionExistente | null;
  duplicado: boolean;
  // true si cédula, nombre, teléfono o correo tienen un error de formato
  // (calculado, no viene de la tabla). Ver validacionMilitante.ts.
  incorrecto: boolean;
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
  // Progreso por rol de coordinador y CDA, independiente entre sí. Para los
  // veedores la medida es "pct": una junta cuenta como cubierta solo con
  // veedor titular Y coordinador titular en su recinto.
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
  // Juntas cubiertas: con veedor titular en un recinto que tiene coordinador
  // titular (y, "Verificada", con ambos ya contactados).
  juntasCubiertas: number;
  juntasCubiertasVerificado: number;
  pctCobertura: number;
  pctCoberturaVerificada: number;
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

// Agregado de CoberturaParroquia sobre todo el cantón (misma forma, sin
// parroquiaCodigo).
export interface CoberturaCanton {
  totalJuntas: number;
  // Juntas cubiertas: con veedor titular en un recinto que tiene coordinador
  // titular (y, "Verificada", con ambos ya contactados).
  juntasCubiertas: number;
  juntasCubiertasVerificado: number;
  pctCobertura: number;
  pctCoberturaVerificada: number;
  totalRecintos: number;
  recintosConCoordinador: number;
  recintosConCoordinadorVerificado: number;
  pctCoordinador: number;
  pctCoordinadorVerificado: number;
  totalRecintosCda: number;
  recintosConCda: number;
  recintosConCdaVerificado: number;
  pctCda: number;
  pctCdaVerificado: number;
}

// A qué "track" (rol) se refiere un gráfico de cobertura: veedores (por
// junta), coordinadores o acreditados CDA (por recinto).
export type CoberturaTrack = "veedores" | "coordinadores" | "cda";

// Un cambio puntual dentro de una edición de Militancia.
export interface CambioMilitante {
  campo: string;
  antes: string;
  despues: string;
}

export interface EdicionMilitante {
  id: string;
  militanteId: string;
  usuario: string;
  cambios: CambioMilitante[];
  creadoEn: string;
}
