import type { FilaRecinto } from "./cifras";

// Dos análisis: "noverificado" cuenta a todos los titulares ingresados, estén
// o no verificados; "verificado" cuenta solo a los ya verificados (los que
// están ingresados pero sin verificar figuran como faltantes).
export type AnalisisSimple = "noverificado" | "verificado";

// Un titular que está registrado pero no puede cubrir el puesto (menor de
// edad, cédula no encontrada o inválida): no cuenta como cubierto y hay que
// reemplazarlo.
export interface PersonaPorReemplazar {
  recintoCodigo: number;
  nombres: string;
  cedula: string;
  rol: "coordinador" | "cda" | "veedor";
  junta: string | null;
  motivo: string;
  // Si fue contactado: en el análisis verificado solo se descuentan estos.
  verificado: boolean;
}

// Un suplente: no cubre ningún puesto, pero es gente de más con la que ya se
// cuenta en el recinto (el exceso).
export interface PersonaSuplente {
  recintoCodigo: number;
  rol: PersonaPorReemplazar["rol"];
  verificado: boolean;
}

// Personas titulares que faltan pedir: un coordinador por recinto, un veedor
// por junta y un acreditado por recinto CDA. Los suplentes no cuentan. La
// misma forma sirve para contar el exceso (suplentes) por rol.
export interface Faltantes {
  coordinadores: number;
  veedores: number;
  cda: number;
  total: number;
}

export interface RecintoSimple {
  recinto: string;
  coordinador: boolean;
  veedoresTenemos: number;
  veedoresFaltan: number;
  // null cuando el recinto no es CDA.
  cda: boolean | null;
  faltan: number;
  porReemplazar: PersonaPorReemplazar[];
  exceso: Faltantes;
}

export interface ParroquiaSimple {
  nombre: string;
  urbana: boolean;
  faltan: Faltantes;
  recintos: RecintoSimple[];
}

export interface InformeSimple {
  parroquias: ParroquiaSimple[];
  urbanas: Faltantes;
  rurales: Faltantes;
  canton: Faltantes;
  porReemplazar: number;
  exceso: Faltantes;
}

const sinFaltantes = (): Faltantes => ({
  coordinadores: 0,
  veedores: 0,
  cda: 0,
  total: 0,
});

export function sumarFaltantes(lista: Faltantes[]): Faltantes {
  const t = sinFaltantes();
  for (const f of lista) {
    t.coordinadores += f.coordinadores;
    t.veedores += f.veedores;
    t.cda += f.cda;
    t.total += f.total;
  }
  return t;
}

// Por parroquia y recinto, lo que hay y lo que falta pedir en el territorio.
// Las urbanas van primero y luego las rurales; dentro de cada grupo, primero
// donde más personas faltan.
export function armarInformeSimple(
  filas: FilaRecinto[],
  analisis: AnalisisSimple = "noverificado",
  porReemplazar: PersonaPorReemplazar[] = [],
  suplentes: PersonaSuplente[] = [],
): InformeSimple {
  const verificado = analisis === "verificado";
  const tiene = (c: { ingresados: number; verificados: number }) =>
    verificado ? c.verificados : c.ingresados;
  // Quienes contarían como cubiertos en este análisis pero no pueden serlo.
  const descontar = (p: PersonaPorReemplazar) => !verificado || p.verificado;
  const reemplazosDe = new Map<number, PersonaPorReemplazar[]>();
  for (const p of porReemplazar) {
    reemplazosDe.set(p.recintoCodigo, [
      ...(reemplazosDe.get(p.recintoCodigo) ?? []),
      p,
    ]);
  }
  // En el análisis verificado, el exceso también cuenta solo a los verificados.
  const excesoDe = new Map<number, Faltantes>();
  for (const s of suplentes) {
    if (verificado && !s.verificado) continue;
    const e = excesoDe.get(s.recintoCodigo) ?? sinFaltantes();
    if (s.rol === "coordinador") e.coordinadores += 1;
    else if (s.rol === "veedor") e.veedores += 1;
    else e.cda += 1;
    e.total += 1;
    excesoDe.set(s.recintoCodigo, e);
  }

  const porParroquia = new Map<
    number,
    {
      nombre: string;
      urbana: boolean;
      recintos: (RecintoSimple & { f: Faltantes })[];
    }
  >();
  for (const f of filas) {
    const reemplazos = reemplazosDe.get(f.codigo) ?? [];
    const menos = (rol: PersonaPorReemplazar["rol"]) =>
      reemplazos.filter((p) => p.rol === rol && descontar(p)).length;
    const coordinador = tiene(f.coordinadores) - menos("coordinador") > 0;
    const veedoresTenemos = Math.max(0, tiene(f.veedores) - menos("veedor"));
    const veedoresFaltan = Math.max(0, f.veedores.requerido - veedoresTenemos);
    const cda = f.esCda ? tiene(f.cda) - menos("cda") > 0 : null;
    const faltantes: Faltantes = {
      coordinadores: coordinador ? 0 : 1,
      veedores: veedoresFaltan,
      cda: cda === false ? 1 : 0,
      total: 0,
    };
    faltantes.total =
      faltantes.coordinadores + faltantes.veedores + faltantes.cda;

    let p = porParroquia.get(f.parroquiaCodigo);
    if (!p) {
      p = { nombre: f.parroquia, urbana: f.urbana, recintos: [] };
      porParroquia.set(f.parroquiaCodigo, p);
    }
    p.recintos.push({
      recinto: f.recinto,
      coordinador,
      veedoresTenemos,
      veedoresFaltan,
      cda,
      faltan: faltantes.total,
      porReemplazar: reemplazos,
      exceso: excesoDe.get(f.codigo) ?? sinFaltantes(),
      f: faltantes,
    });
  }

  const parroquias: ParroquiaSimple[] = [...porParroquia.values()]
    .map((p) => ({
      nombre: p.nombre,
      urbana: p.urbana,
      faltan: sumarFaltantes(p.recintos.map((r) => r.f)),
      recintos: p.recintos
        .sort(
          (a, b) => b.faltan - a.faltan || a.recinto.localeCompare(b.recinto),
        )
        .map(({ f: _f, ...r }) => r),
    }))
    .sort(
      (a, b) =>
        Number(b.urbana) - Number(a.urbana) ||
        b.faltan.total - a.faltan.total ||
        a.nombre.localeCompare(b.nombre),
    );

  const urbanas = sumarFaltantes(
    parroquias.filter((p) => p.urbana).map((p) => p.faltan),
  );
  const rurales = sumarFaltantes(
    parroquias.filter((p) => !p.urbana).map((p) => p.faltan),
  );
  return {
    parroquias,
    urbanas,
    rurales,
    canton: sumarFaltantes([urbanas, rurales]),
    porReemplazar: porReemplazar.length,
    exceso: sumarFaltantes(
      parroquias.flatMap((p) => p.recintos.map((r) => r.exceso)),
    ),
  };
}
