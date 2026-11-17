import { armarLibroXlsx, type Celda, type HojaLibro } from "./libroXlsx";
import {
  compararEnRecinto,
  filasListado,
  type Dignidad,
  type FilaListado,
} from "./listado";
import type { DatosMatriz } from "./matrizXlsx";

// Excel de las parroquias rurales: una hoja por parroquia con sus
// coordinadores, acreditados CDA y veedores (titulares, suplentes y los
// puestos titulares que faltan cubrir), recinto por recinto.

const TIPO: Record<FilaListado["tipo"], string> = {
  titular: "Titular",
  suplente: "Suplente",
};

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

function cubiertos(filas: FilaListado[], dignidad: Dignidad): string {
  const propias = filas.filter(
    (f) => f.dignidad === dignidad && f.tipo === "titular",
  );
  return `${propias.filter((f) => !f.porCubrir).length}/${propias.length}`;
}

export function hojasRurales(datos: DatosMatriz, corte: string): HojaLibro[] {
  const porParroquia = new Map<string, FilaListado[]>();
  for (const f of filasRurales(datos)) {
    porParroquia.set(f.parroquia, [...(porParroquia.get(f.parroquia) ?? []), f]);
  }
  return [...porParroquia.entries()].map(([parroquia, filas]) => {
    const recintos = new Set(filas.map((f) => f.recintoCodigo)).size;
    const suplentes = filas.filter((f) => f.tipo === "suplente").length;
    return {
      nombre: nombreDeHoja(parroquia),
      titulo: `Parroquia ${parroquia} — Coordinadores, acreditados CDA y veedores`,
      subtitulo: [
        `Datos al ${corte}`,
        plural(recintos, "recinto", "recintos"),
        `Titulares cubiertos: coordinadores ${cubiertos(filas, "Coordinador")}, CDA ${cubiertos(filas, "Acreditado CDA")}, veedores ${cubiertos(filas, "Veedor")}`,
        plural(suplentes, "suplente", "suplentes"),
      ].join(" · "),
      encabezados: [
        "N°",
        "Recinto electoral",
        "Dignidad",
        "Junta",
        "Tipo",
        "Nombres",
        "Cédula",
        "Teléfono",
      ],
      anchos: [6, 44, 16, 8, 12, 38, 14, 14],
      filas: filas.map((f, i): Celda[] => [
        i + 1,
        f.recinto,
        f.dignidad,
        f.junta ?? "",
        f.porCubrir ? "Por cubrir" : TIPO[f.tipo],
        f.nombres,
        f.cedula,
        f.telefono,
      ]),
    };
  });
}

export function armarRuralXlsx(datos: DatosMatriz, corte: string): Uint8Array {
  return armarLibroXlsx(hojasRurales(datos, corte));
}
