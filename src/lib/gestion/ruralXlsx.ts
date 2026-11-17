import { armarLibroXlsx, type Celda, type HojaLibro } from "./libroXlsx";
import {
  compararEnRecinto,
  filasListado,
  type Dignidad,
  type FilaListado,
} from "./listado";
import { textoSuplentes, type DatosMatriz } from "./matrizXlsx";

// Excel de las parroquias rurales: una hoja por parroquia con sus
// coordinadores, acreditados CDA y veedores, recinto por recinto. Una fila por
// puesto titular (también los que faltan cubrir) y sus suplentes en
// Observaciones, como en la matriz del CNE.

export function filasRurales(datos: DatosMatriz): FilaListado[] {
  return filasListado({ ...datos, conPorCubrir: true })
    .filter((f) => !f.urbana)
    .sort(
      (a, b) =>
        a.parroquia.localeCompare(b.parroquia, "es") ||
        a.recinto.localeCompare(b.recinto, "es") ||
        compararEnRecinto(a, b),
    );
}

// Excel no admite estos caracteres en el nombre de una hoja, ni más de 31.
export function nombreDeHoja(texto: string): string {
  return texto.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Parroquia";
}

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

const ETIQUETA: Record<Dignidad, string> = {
  Coordinador: "coordinadores",
  "Acreditado CDA": "CDA",
  Veedor: "veedores",
};

// "coordinadores 3/3, veedores 20/22": sin las dignidades que no tienen
// puestos en la parroquia (no todas tienen recinto CDA).
function cubiertos(filas: FilaListado[]): string {
  return (Object.keys(ETIQUETA) as Dignidad[])
    .map((d) => {
      const propias = filas.filter(
        (f) => f.dignidad === d && f.tipo === "titular",
      );
      return propias.length === 0
        ? null
        : `${ETIQUETA[d]} ${propias.filter((f) => !f.porCubrir).length}/${propias.length}`;
    })
    .filter((x): x is string => x !== null)
    .join(", ");
}

export interface PuestoRural {
  titular: FilaListado;
  suplentes: FilaListado[];
}

const clavePuesto = (f: FilaListado) =>
  `${f.recintoCodigo}|${f.dignidad}|${f.junta ?? ""}`;

// Cada suplente junto al titular de su puesto (el mismo recinto, dignidad y
// junta). Si el puesto no tuviera fila de titular, el suplente arma una con
// el titular vacío.
export function puestosRurales(filas: FilaListado[]): PuestoRural[] {
  const puestos: PuestoRural[] = [];
  const dePuesto = new Map<string, PuestoRural>();
  for (const f of filas) {
    if (f.tipo !== "titular") continue;
    const p = { titular: f, suplentes: [] };
    puestos.push(p);
    if (!dePuesto.has(clavePuesto(f))) dePuesto.set(clavePuesto(f), p);
  }
  for (const f of filas) {
    if (f.tipo !== "suplente") continue;
    let p = dePuesto.get(clavePuesto(f));
    if (!p) {
      p = {
        titular: {
          ...f,
          cedula: "",
          nombres: "",
          telefono: "",
          tipo: "titular",
          porCubrir: true,
        },
        suplentes: [],
      };
      puestos.push(p);
      dePuesto.set(clavePuesto(f), p);
    }
    p.suplentes.push(f);
  }
  return puestos.sort(
    (a, b) =>
      a.titular.recinto.localeCompare(b.titular.recinto, "es") ||
      compararEnRecinto(a.titular, b.titular),
  );
}

function observaciones(p: PuestoRural): string {
  return [
    p.titular.porCubrir ? "Por cubrir" : "",
    textoSuplentes(
      [...p.suplentes].sort((a, b) => a.nombres.localeCompare(b.nombres, "es")),
    ),
  ]
    .filter(Boolean)
    .join("; ");
}

export function hojasRurales(datos: DatosMatriz, corte: string): HojaLibro[] {
  const porParroquia = new Map<string, FilaListado[]>();
  for (const f of filasRurales(datos)) {
    porParroquia.set(f.parroquia, [...(porParroquia.get(f.parroquia) ?? []), f]);
  }
  return [...porParroquia.entries()].map(([parroquia, filas]) => {
    const recintos = new Set(filas.map((f) => f.recintoCodigo)).size;
    const suplentes = filas.filter((f) => f.tipo === "suplente").length;
    const puestos = puestosRurales(filas);
    return {
      nombre: nombreDeHoja(parroquia),
      titulo: `Parroquia ${parroquia} — Coordinadores, acreditados CDA y veedores`,
      subtitulo: [
        `Datos al ${corte}`,
        plural(recintos, "recinto", "recintos"),
        `Titulares cubiertos: ${cubiertos(filas)}`,
        `${plural(suplentes, "suplente", "suplentes")} en Observaciones`,
      ].join(" · "),
      encabezados: [
        "N°",
        "Recinto electoral",
        "Junta",
        "Dignidad",
        "Nombres",
        "Cédula",
        "Teléfono",
        "Observaciones",
      ],
      anchos: [6, 44, 8, 16, 38, 14, 14, 56],
      filas: puestos.map((p, i): Celda[] => [
        i + 1,
        p.titular.recinto,
        p.titular.junta ?? "",
        p.titular.dignidad,
        p.titular.nombres,
        p.titular.cedula,
        p.titular.telefono,
        observaciones(p),
      ]),
    };
  });
}

export function armarRuralXlsx(datos: DatosMatriz, corte: string): Uint8Array {
  return armarLibroXlsx(hojasRurales(datos, corte));
}
