import { cedulaEcuatorianaValida } from "../gestion/validacionMilitante";
import { compararNombres, nombreOficial, type Coincidencia } from "./nombres";
import type { EstadoValidacion } from "./ecuadorApi";

// Lógica pura del módulo de validación: quién está en el sistema, qué cédulas
// falta consultar y qué nombres conviene corregir. Sin acceso a la base ni a
// la API, para poder probarla.

export interface ValidacionCedula {
  cedula: string;
  estado: EstadoValidacion;
  nombres: string | null;
  apellidos: string | null;
  nombreCompleto: string | null;
  respuesta: unknown;
  httpStatus: number | null;
  error: string | null;
  intentos: number;
  proveedor: string;
  consultadoEn: string;
}

export interface PersonaRegistrada {
  cedula: string;
  // Nombres tal como están en cada lugar (sin repetir).
  nombres: string[];
  // Dónde consta: "Coordinador", "Veedor", "Militancia"...
  donde: string[];
}

export interface Fuente {
  donde: string;
  personas: { cedula: string | null; nombres: string }[];
}

// Orden para consultar primero a quienes ya cubren un puesto.
const PRIORIDAD = [
  "Coordinador",
  "Acreditado CDA",
  "Veedor",
  "Líder",
  "Militancia",
];
const prioridad = (p: PersonaRegistrada) =>
  Math.min(
    ...p.donde.map((d) => {
      const i = PRIORIDAD.indexOf(d);
      return i === -1 ? PRIORIDAD.length : i;
    }),
  );

export function agruparPersonas(fuentes: Fuente[]): PersonaRegistrada[] {
  const porCedula = new Map<string, PersonaRegistrada>();
  for (const fuente of fuentes) {
    for (const p of fuente.personas) {
      const cedula = p.cedula?.trim();
      if (!cedula) continue;
      const actual = porCedula.get(cedula) ?? {
        cedula,
        nombres: [],
        donde: [],
      };
      const nombre = p.nombres.trim();
      if (nombre && !actual.nombres.includes(nombre))
        actual.nombres.push(nombre);
      if (!actual.donde.includes(fuente.donde)) actual.donde.push(fuente.donde);
      porCedula.set(cedula, actual);
    }
  }
  return [...porCedula.values()].sort(
    (a, b) => prioridad(a) - prioridad(b) || a.cedula.localeCompare(b.cedula),
  );
}

export interface FilaRevision {
  cedula: string;
  registrados: string[];
  oficial: string;
  coincidencia: Coincidencia;
  donde: string[];
}

export interface ResumenValidacion {
  personas: number;
  validadas: number;
  noEncontradas: number;
  conError: number;
  // Cédulas que se consultarían: dígito verificador correcto y sin validación
  // previa (o con un error técnico que se reintenta).
  pendientes: PersonaRegistrada[];
  // No se consultan: la API las rechazaría y se pagaría igual.
  invalidas: PersonaRegistrada[];
  // Validadas cuyo nombre en el sistema no está en el formato oficial.
  revision: FilaRevision[];
  noEncontradasDetalle: {
    persona: PersonaRegistrada;
    validacion: ValidacionCedula;
  }[];
}

export function resumirValidacion(
  personas: PersonaRegistrada[],
  validaciones: ValidacionCedula[],
): ResumenValidacion {
  const porCedula = new Map(validaciones.map((v) => [v.cedula, v]));
  const resumen: ResumenValidacion = {
    personas: personas.length,
    validadas: 0,
    noEncontradas: 0,
    conError: 0,
    pendientes: [],
    invalidas: [],
    revision: [],
    noEncontradasDetalle: [],
  };
  for (const p of personas) {
    const v = porCedula.get(p.cedula);
    if (v?.estado === "validada") {
      resumen.validadas += 1;
      const oficial = nombreOficial(v.nombres, v.apellidos, v.nombreCompleto);
      if (p.nombres.some((n) => n !== oficial)) {
        const distintos = p.nombres.filter((n) => n !== oficial);
        const peor = distintos
          .map((n) => compararNombres(n, oficial))
          .sort((a, b) => ORDEN[b] - ORDEN[a])[0];
        resumen.revision.push({
          cedula: p.cedula,
          registrados: distintos,
          oficial,
          coincidencia: peor,
          donde: p.donde,
        });
      }
      continue;
    }
    if (v?.estado === "no_encontrada") {
      resumen.noEncontradas += 1;
      resumen.noEncontradasDetalle.push({ persona: p, validacion: v });
      continue;
    }
    if (v?.estado === "error") resumen.conError += 1;
    if (!cedulaEcuatorianaValida(p.cedula)) resumen.invalidas.push(p);
    else resumen.pendientes.push(p);
  }
  resumen.revision.sort(
    (a, b) =>
      ORDEN[b.coincidencia] - ORDEN[a.coincidencia] ||
      a.oficial.localeCompare(b.oficial),
  );
  return resumen;
}

const ORDEN: Record<Coincidencia, number> = {
  igual: 0,
  parecido: 1,
  distinto: 2,
};
