import { armarLibroXlsx, type Celda, type HojaLibro } from "./libroXlsx";
import {
  compararEnRecinto,
  filasListado,
  type Dignidad,
  type FilaListado,
} from "./listado";
import type { DatosMatriz } from "./matrizXlsx";

// Excel de las parroquias rurales: una hoja por dignidad (coordinadores,
// acreditados CDA y veedores), con titulares, suplentes y los puestos
// titulares que faltan cubrir, ordenados por parroquia, recinto y junta.

const HOJAS: { dignidad: Dignidad; nombre: string; titulo: string }[] = [
  {
    dignidad: "Coordinador",
    nombre: "Coordinadores",
    titulo: "Coordinadores de recinto — Parroquias rurales de Latacunga",
  },
  {
    dignidad: "Acreditado CDA",
    nombre: "Acreditados CDA",
    titulo: "Acreditados CDA — Parroquias rurales de Latacunga",
  },
  {
    dignidad: "Veedor",
    nombre: "Veedores",
    titulo: "Veedores por junta — Parroquias rurales de Latacunga",
  },
];

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

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

export function hojasRurales(datos: DatosMatriz, corte: string): HojaLibro[] {
  const filas = filasRurales(datos);
  return HOJAS.map(({ dignidad, nombre, titulo }) => {
    const propias = filas.filter((f) => f.dignidad === dignidad);
    const conJunta = dignidad === "Veedor";
    const titulares = propias.filter(
      (f) => f.tipo === "titular" && !f.porCubrir,
    ).length;
    const puestos = propias.filter((f) => f.tipo === "titular").length;
    const suplentes = propias.filter((f) => f.tipo === "suplente").length;
    return {
      nombre,
      titulo,
      subtitulo: [
        `Datos al ${corte}`,
        `${titulares} de ${puestos} puestos titulares cubiertos`,
        plural(suplentes, "suplente", "suplentes"),
      ].join(" · "),
      encabezados: [
        "N°",
        "Parroquia",
        "Recinto electoral",
        ...(conJunta ? ["Junta"] : []),
        "Tipo",
        "Nombres",
        "Cédula",
        "Teléfono",
      ],
      anchos: [6, 22, 44, ...(conJunta ? [8] : []), 12, 38, 14, 14],
      filas: propias.map((f, i): Celda[] => [
        i + 1,
        f.parroquia,
        f.recinto,
        ...(conJunta ? [f.junta ?? ""] : []),
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
