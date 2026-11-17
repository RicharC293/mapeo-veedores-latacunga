import { title } from "../format";
import { coincideUbicacion, type Ubicacion } from "../gestion/ubicacion";
import { textoJunta, textoRol, type Clase } from "../contacto/plan";
import { juntaCorta } from "../gestion/listado";
import type { ParroquiaBasica, Recinto } from "../types";

// Lógica pura de los comunicados por WhatsApp: a quién va cada uno, cómo se
// completa el mensaje con los datos de cada persona y cómo se agrupan quienes
// comparten celular. Sin base ni API, para poder probarla.

export interface FiltrosComunicado {
  ubicacion: Ubicacion;
  // Un recinto concreto, o null para todos los de la ubicación.
  recinto: number | null;
  dignidades: Clase[];
  tipo: "todos" | "titular" | "suplente";
  // "todos", "sin" (sin responsable) o el id de un líder.
  responsable: string;
  // Suma a quienes siguen en Militancia sin asignar.
  militancia: boolean;
  // Solo quienes están en un recinto con grupo de WhatsApp cargado.
  soloConGrupo: boolean;
}

export const DIGNIDADES: Clase[] = ["coordinador", "cda", "veedor"];

export const FILTROS_INICIALES: FiltrosComunicado = {
  ubicacion: "todas",
  recinto: null,
  dignidades: DIGNIDADES,
  tipo: "todos",
  responsable: "todos",
  militancia: false,
  soloConGrupo: false,
};

// Filtros guardados en la base (jsonb) → FiltrosComunicado, con los valores
// por defecto en lo que falte o no se reconozca.
export function leerFiltros(valor: unknown): FiltrosComunicado {
  const v = (valor ?? {}) as Partial<Record<keyof FiltrosComunicado, unknown>>;
  const u = v.ubicacion;
  return {
    ubicacion:
      u === "urbanas" || u === "rurales" || typeof u === "number" ? u : "todas",
    recinto: typeof v.recinto === "number" ? v.recinto : null,
    dignidades: Array.isArray(v.dignidades)
      ? DIGNIDADES.filter((d) => (v.dignidades as unknown[]).includes(d))
      : DIGNIDADES,
    tipo: v.tipo === "titular" || v.tipo === "suplente" ? v.tipo : "todos",
    responsable:
      typeof v.responsable === "string" && v.responsable !== ""
        ? v.responsable
        : "todos",
    militancia: v.militancia === true,
    soloConGrupo: v.soloConGrupo === true,
  };
}

export interface Comunicado {
  id: string;
  titulo: string;
  mensaje: string;
  enlace: string;
  filtros: FiltrosComunicado;
  creadoPor: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface EnvioComunicado {
  comunicadoId: string;
  numero: string;
  enviadoPor: string | null;
  enviadoEn: string;
}

// Una persona a la que se le puede escribir: del Consolidado o, con clase
// null, de Militancia (aún sin puesto).
export interface PersonaComunicado {
  cedula: string;
  nombres: string;
  // Nombres de pila para el saludo (ver nombreDeSaludo).
  saludo: string;
  // Apellidos (ver apellidosDeSaludo).
  apellidos: string;
  telefono: string;
  femenino: boolean;
  clase: Clase | null;
  tipo: "titular" | "suplente" | null;
  // Su recinto o, en Militancia, el de preferencia si se reconoció.
  recintoCodigo: number | null;
  juntaId: string | null;
  responsableId: string | null;
}

export function coincideFiltros(
  p: PersonaComunicado,
  f: FiltrosComunicado,
  parroquia: ParroquiaBasica | undefined,
  // Si su recinto ya tiene grupo de WhatsApp.
  conGrupo = false,
): boolean {
  if (f.soloConGrupo && !conGrupo) return false;
  if (p.clase === null) {
    if (!f.militancia) return false;
  } else {
    if (!f.dignidades.includes(p.clase)) return false;
    if (f.tipo !== "todos" && p.tipo !== f.tipo) return false;
  }
  if (f.recinto !== null && p.recintoCodigo !== f.recinto) return false;
  if (!coincideUbicacion(f.ubicacion, parroquia)) return false;
  if (f.responsable === "sin") return p.responsableId === null;
  return f.responsable === "todos" || p.responsableId === f.responsable;
}

// Los datos que se pueden poner en el mensaje, en el orden de los botones.
export const CAMPOS = [
  { clave: "nombre", etiqueta: "Nombre" },
  { clave: "apellido", etiqueta: "Apellido" },
  { clave: "rol", etiqueta: "Rol" },
  { clave: "recinto", etiqueta: "Recinto" },
  { clave: "parroquia", etiqueta: "Parroquia" },
  { clave: "direccion", etiqueta: "Dirección" },
  { clave: "junta", etiqueta: "Junta" },
  // El grupo de WhatsApp de su recinto (se carga en el Consolidado).
  { clave: "grupo", etiqueta: "Grupo del recinto" },
  // El equipo de su recinto, una persona por línea (ver textoEquipo). Solo
  // para coordinadores: a los demás les queda vacío.
  { clave: "equipoCoordinador", etiqueta: "Equipo coordinador" },
  { clave: "equipoCda", etiqueta: "Equipo CDA" },
  { clave: "equipoVeedores", etiqueta: "Equipo veedores" },
  { clave: "enlace", etiqueta: "Enlace" },
] as const;

export type Campo = (typeof CAMPOS)[number]["clave"];
export type DatosComunicado = Record<Campo, string>;

// El equipo del recinto: solo lo reciben los coordinadores.
export const CAMPOS_DE_EQUIPO: Campo[] = [
  "equipoCoordinador",
  "equipoCda",
  "equipoVeedores",
];

export interface MiembroEquipo {
  nombres: string;
  tipo: "titular" | "suplente";
  juntaId: string | null;
}

// Quienes tienen puesto en un recinto, por dignidad.
export type EquipoRecinto = Record<Clase, MiembroEquipo[]>;

// Una línea por persona: "• 1F: Ana Pérez", "• 1F: Luis Mena (suplente)";
// por junta (1F, 1M, 2F…) y el titular antes que sus suplentes.
export function textoEquipo(miembros: MiembroEquipo[]): string {
  const junta = (m: MiembroEquipo) => (m.juntaId ? juntaCorta(m.juntaId) : "");
  return [...miembros]
    .sort(
      (a, b) =>
        Number.parseInt(junta(a) || "0", 10) -
          Number.parseInt(junta(b) || "0", 10) ||
        junta(a).localeCompare(junta(b)) ||
        Number(a.tipo === "suplente") - Number(b.tipo === "suplente") ||
        a.nombres.localeCompare(b.nombres, "es"),
    )
    .map(
      (m) =>
        `• ${m.juntaId ? `${junta(m)}: ` : ""}${title(m.nombres.trim())}${m.tipo === "suplente" ? " (suplente)" : ""}`,
    )
    .join("\n");
}

export function datosDe(
  p: PersonaComunicado,
  recinto: Recinto | undefined,
  parroquia: ParroquiaBasica | undefined,
  enlace: string,
  // Enlace del grupo de WhatsApp del recinto, o "" si aún no tiene.
  grupo = "",
  // Quienes tienen puesto en su recinto: solo se usa si es coordinador.
  equipo?: EquipoRecinto,
): DatosComunicado {
  const suEquipo = p.clase === "coordinador" ? equipo : undefined;
  return {
    nombre: p.saludo,
    apellido: p.apellidos,
    rol: p.clase && p.tipo ? textoRol(p.clase, p.femenino, p.tipo) : "",
    recinto: recinto ? title(recinto.nombre) : "",
    parroquia: parroquia?.properties.name ?? "",
    direccion: recinto?.dir.trim() ? title(recinto.dir) : "",
    junta: p.juntaId ? textoJunta(p.juntaId) : "",
    grupo: grupo.trim(),
    equipoCoordinador: textoEquipo(suEquipo?.coordinador ?? []),
    equipoCda: textoEquipo(suEquipo?.cda ?? []),
    equipoVeedores: textoEquipo(suEquipo?.veedor ?? []),
    enlace: enlace.trim(),
  };
}

// "Ana", "Ana y Luis", "Ana, Luis y Rosa": sin repetidos ni vacíos.
export function unirTextos(valores: string[]): string {
  const unicos = [...new Set(valores.map((v) => v.trim()).filter(Boolean))];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} y ${unicos[unicos.length - 1]}`;
}

// Quienes comparten celular reciben un solo mensaje que los nombra a todos.
export function combinarDatos(lista: DatosComunicado[]): DatosComunicado {
  const datos = {} as DatosComunicado;
  for (const { clave } of CAMPOS) {
    datos[clave] = unirTextos(lista.map((d) => d[clave]));
  }
  return datos;
}

// Reemplaza cada {campo} conocido; lo demás entre llaves queda tal cual.
export function rellenar(plantilla: string, datos: DatosComunicado): string {
  return plantilla.replace(/\{(\w+)\}/g, (marca, clave: string) =>
    clave in datos ? datos[clave as Campo] : marca,
  );
}

// Campos que la plantilla usa y que en estos datos quedarían vacíos, salvo
// los que se dejan vacíos a propósito (el equipo, a quien no coordina).
export function camposVacios(
  plantilla: string,
  datos: DatosComunicado,
  ignorar: Campo[] = [],
): Campo[] {
  return CAMPOS.map((c) => c.clave).filter(
    (clave) =>
      !ignorar.includes(clave) &&
      plantilla.includes(`{${clave}}`) &&
      datos[clave] === "",
  );
}

export interface GrupoNumero<T> {
  numero: string;
  personas: T[];
}

// Agrupa por celular (en formato wa.me). Quien no tiene un celular válido
// queda aparte: no se le puede escribir.
export function agruparPorNumero<T>(
  personas: T[],
  numeroDe: (p: T) => string | null,
): { grupos: GrupoNumero<T>[]; sinNumero: T[] } {
  const mapa = new Map<string, T[]>();
  const sinNumero: T[] = [];
  for (const p of personas) {
    const numero = numeroDe(p);
    if (numero) mapa.set(numero, [...(mapa.get(numero) ?? []), p]);
    else sinNumero.push(p);
  }
  return {
    grupos: [...mapa.entries()].map(([numero, delNumero]) => ({
      numero,
      personas: delNumero,
    })),
    sinNumero,
  };
}

export const MENSAJE_INICIAL = [
  "¡Hola, {nombre}! 👋",
  "",
  "",
  "Campo Ciudad, Una Sola Fuerza",
].join("\n");
