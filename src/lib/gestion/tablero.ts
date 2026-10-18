import { pct } from "./coverage";
import { sumar } from "./cifras";
import type { Cifras, FilaRecinto } from "./cifras";

// Lógica pura de los gráficos de Cobertura: qué recintos entran según los
// filtros, cuántos cuentan según el modo (todos los ingresados, solo los
// verificados o los que faltan por verificar) y qué barras y segmentos se
// dibujan. Vive aparte de los componentes para poder probarla.

export type Modo = "ingresados" | "verificados" | "sinverificar";
export type Rol = "general" | "veedores" | "coordinadores" | "cda";
export type Ambito = "todas" | "urbanas" | "rurales";

export interface Alcance {
  ambito: Ambito;
  parroquia: number | "";
  recinto: number | "";
}

export const MODOS: { clave: Modo; etiqueta: string }[] = [
  { clave: "ingresados", etiqueta: "Todos los ingresados" },
  { clave: "verificados", etiqueta: "Solo verificados" },
  { clave: "sinverificar", etiqueta: "Ingresados sin verificar" },
];

export const ETIQUETA_ROL: Record<Rol, string> = {
  general: "General",
  veedores: "Veedores",
  coordinadores: "Coordinadores",
  cda: "Acreditados CDA",
};

// Cuánto cuenta una fila de cifras según el modo.
export function cantidad(c: Cifras, modo: Modo): number {
  if (modo === "verificados") return c.verificados;
  if (modo === "sinverificar") return Math.max(0, c.ingresados - c.verificados);
  return c.ingresados;
}

export function porcentaje(c: Cifras, modo: Modo): number {
  return pct(cantidad(c, modo), c.requerido);
}

// El rol de las cifras que se miden en cada vista. "General" mide la cobertura
// completa (veedor titular y coordinador en su recinto).
export function claveCifras(
  rol: Rol,
): "veedores" | "coordinadores" | "cda" | "completa" {
  return rol === "general" ? "completa" : rol;
}

export function filtrarRecintos(
  filas: FilaRecinto[],
  alcance: Alcance,
): FilaRecinto[] {
  return filas.filter((f) => {
    if (alcance.ambito === "urbanas" && !f.urbana) return false;
    if (alcance.ambito === "rurales" && f.urbana) return false;
    if (alcance.parroquia !== "" && f.parroquiaCodigo !== alcance.parroquia)
      return false;
    if (alcance.recinto !== "" && f.codigo !== alcance.recinto) return false;
    return true;
  });
}

export interface Barra {
  etiqueta: string;
  pct: number;
  cantidad: number;
  requerido: number;
}

const barra = (etiqueta: string, c: Cifras, modo: Modo): Barra => ({
  etiqueta,
  pct: porcentaje(c, modo),
  cantidad: cantidad(c, modo),
  requerido: c.requerido,
});

// Las barras de un gráfico. En "General" una por rol; en los demás, un
// desglose del alcance elegido: por parroquia, por recinto de la parroquia
// elegida o el recinto elegido. Ordenadas de mayor a menor porcentaje.
export function barras(
  filasFiltradas: FilaRecinto[],
  rol: Rol,
  modo: Modo,
  alcance: Alcance,
  nombreRecinto: (f: FilaRecinto) => string = (f) => f.recinto,
): Barra[] {
  if (rol === "general") {
    const t = sumar(filasFiltradas);
    return [
      barra("Veedores", t.veedores, modo),
      barra("Coordinadores", t.coordinadores, modo),
      ...(t.cda.requerido > 0 ? [barra("Acreditados CDA", t.cda, modo)] : []),
      barra("Cobertura completa", t.completa, modo),
    ];
  }
  const clave = claveCifras(rol);
  const conPuesto = filasFiltradas.filter((f) => f[clave].requerido > 0);
  let resultado: Barra[];
  if (alcance.parroquia === "") {
    const porParroquia = new Map<number, FilaRecinto[]>();
    for (const f of conPuesto) {
      const lista = porParroquia.get(f.parroquiaCodigo);
      if (lista) lista.push(f);
      else porParroquia.set(f.parroquiaCodigo, [f]);
    }
    resultado = [...porParroquia.values()].map((lista) =>
      barra(lista[0].parroquia, sumar(lista)[clave], modo),
    );
  } else {
    resultado = conPuesto.map((f) => barra(nombreRecinto(f), f[clave], modo));
  }
  return resultado.sort(
    (a, b) => b.pct - a.pct || a.etiqueta.localeCompare(b.etiqueta),
  );
}

export interface Segmento {
  etiqueta: string;
  valor: number;
  tono: "principal" | "resto";
}

// Dos segmentos: lo que cuenta según el modo y el resto hasta el requerido.
export function segmentos(c: Cifras, modo: Modo): Segmento[] {
  const cuenta = cantidad(c, modo);
  const resto = Math.max(0, c.requerido - cuenta);
  const nombres = {
    ingresados: ["Ingresados", "Faltan por ingresar"],
    verificados: ["Verificados", "Sin verificar o sin ingresar"],
    sinverificar: ["Ingresados sin verificar", "Verificados o sin ingresar"],
  }[modo];
  return [
    { etiqueta: nombres[0], valor: cuenta, tono: "principal" },
    { etiqueta: nombres[1], valor: resto, tono: "resto" },
  ];
}

interface PersonaConRecinto {
  recintoCodigo: number;
  verificado: boolean;
}

// Personas que cuentan en un alcance y modo: las de los recintos filtrados y,
// según el modo, todas, solo las verificadas o solo las no verificadas.
export function personasDelAlcance<P extends PersonaConRecinto>(
  personas: P[],
  filasFiltradas: FilaRecinto[],
  modo: Modo,
): P[] {
  const recintos = new Set(filasFiltradas.map((f) => f.codigo));
  return personas.filter((p) => {
    if (!recintos.has(p.recintoCodigo)) return false;
    if (modo === "verificados") return p.verificado;
    if (modo === "sinverificar") return !p.verificado;
    return true;
  });
}
