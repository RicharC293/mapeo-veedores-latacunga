import type { AlcanceMatriz } from "./matrizXlsx";

export type TipoDescarga = AlcanceMatriz | "cda";

export interface OpcionDescarga {
  tipo: TipoDescarga;
  titulo: string;
  descripcion: string;
  // Parte del nombre del archivo.
  archivo: string;
}

export const OPCIONES_DESCARGA: OpcionDescarga[] = [
  {
    tipo: "todo",
    titulo: "Matriz completa",
    descripcion:
      "La plantilla con los coordinadores de cada recinto y los veedores de cada junta, en la hoja de su parroquia.",
    archivo: "Matriz_Veedores_2027_JRV_CNE_completa",
  },
  {
    tipo: "veedores",
    titulo: "Solo veedores",
    descripcion:
      "La misma plantilla con los veedores de cada junta. Las casillas de coordinador quedan en blanco.",
    archivo: "Matriz_Veedores_2027_JRV_CNE_solo-veedores",
  },
  {
    tipo: "coordinadores",
    titulo: "Solo coordinadores",
    descripcion:
      "La misma plantilla con los coordinadores de cada recinto. Las casillas de veedor quedan en blanco.",
    archivo: "Matriz_Veedores_2027_JRV_CNE_solo-coordinadores",
  },
  {
    tipo: "cda",
    titulo: "Solo acreditados CDA",
    descripcion:
      "Una hoja con los 19 recintos CDA y el acreditado de cada uno. La plantilla no trae esta tabla, así que va en un archivo aparte.",
    archivo: "Acreditados_CDA_Latacunga",
  },
];

export function opcionDescarga(tipo: string | null): OpcionDescarga | null {
  return OPCIONES_DESCARGA.find((o) => o.tipo === tipo) ?? null;
}

// Fecha para el nombre del archivo (en hora de Ecuador).
export function fechaArchivo(ahora: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
  }).format(new Date(ahora));
}
