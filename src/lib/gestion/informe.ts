import { agruparPor, consolidarRecinto } from "./consolidado";
import { calcularCobertura, pct } from "./coverage";
import { calcularCuentaRegresiva, ELECCIONES_INICIO } from "./cuentaRegresiva";
import type { CuentaRegresiva } from "./cuentaRegresiva";
import type { ParroquiaBasica, Recinto } from "../types";
import type { AcreditadoCda, Coordinador, Veedor } from "./types";

// Todo el informe de cobertura se arma aquí, sin servidor ni pantalla, a partir
// de los mismos cálculos de Cobertura (calcularCobertura) y de Consolidado
// (consolidarRecinto): así las cifras de las tres pantallas no pueden diferir.

export interface PersonaMilitancia {
  cedula: string;
  incorrecto: boolean;
  duplicado: boolean;
  asignado: unknown | null;
  // Recinto ya precargado en la fila de Militancia, si lo tiene.
  recintoCodigo?: number | null;
}

export interface EntradaInforme {
  recintos: Recinto[];
  parroquias: ParroquiaBasica[];
  veedores: Veedor[];
  coordinadores: Coordinador[];
  acreditados: AcreditadoCda[];
  militantes: PersonaMilitancia[];
  ahora: number;
}

// Las seis cifras que se repiten en todas las tablas del informe.
export interface Cifras {
  // Puestos titulares que se necesitan: juntas, recintos o recintos CDA.
  requerido: number;
  ingresados: number;
  verificados: number;
  faltan: number;
  pct: number;
  pctFaltante: number;
}

export interface CifrasPorRol {
  veedores: Cifras;
  coordinadores: Cifras;
  cda: Cifras;
  // Juntas con veedor titular y coordinador titular en su recinto.
  completa: Cifras;
}

export type EstadoRecinto = "completo" | "casi" | "pendiente";

export interface FilaRecinto extends CifrasPorRol {
  codigo: number;
  parroquiaCodigo: number;
  parroquia: string;
  urbana: boolean;
  recinto: string;
  esCda: boolean;
  estado: EstadoRecinto;
}

export interface FilaParroquia extends CifrasPorRol {
  codigo: number;
  nombre: string;
  urbana: boolean;
  // Recintos de la parroquia, ordenados por nombre.
  recintos: FilaRecinto[];
}

export interface FilaRol extends Cifras {
  clave: "veedores" | "coordinadores" | "cda" | "completa";
  etiqueta: string;
}

// Un recinto que ya tiene coordinador y aún necesita veedores: cada veedor
// titular que se consiga suma una junta cubierta.
export interface AccionVeedores {
  recintoCodigo: number;
  recinto: string;
  parroquia: string;
  sinVeedor: number;
  totalJuntas: number;
}

export interface AccionPrioritaria {
  recintoCodigo: number;
  recinto: string;
  parroquia: string;
  // Juntas con veedor titular que hoy no cuentan por falta de coordinador:
  // las que se "desbloquean" al asignarlo.
  desbloquea: number;
  totalJuntas: number;
  acumulado: number;
  // Cobertura completa del cantón si se asigna coordinador a este recinto y
  // a todos los anteriores de la lista.
  pctAcumulado: number;
}

export interface Informe {
  corte: number;
  totales: { juntas: number; recintos: number; recintosCda: number };
  cobertura: {
    cubiertas: number;
    cubiertasVerificadas: number;
    pct: number;
    pctVerificadas: number;
  };
  roles: FilaRol[];
  urbanas: FilaParroquia[];
  rurales: FilaParroquia[];
  subtotalUrbanas: CifrasPorRol;
  subtotalRurales: CifrasPorRol;
  total: CifrasPorRol;
  acciones: AccionPrioritaria[];
  accionesVeedores: AccionVeedores[];
  militancia: {
    total: number;
    incorrectos: number;
    duplicados: number;
    repetidosAsignados: number;
    // Personas pendientes que ya traen recinto, listas para asignar.
    conRecinto: number;
  };
  ritmo: {
    puestosNecesarios: number;
    personasUnicas: number;
    faltan: number;
    cuenta: CuentaRegresiva;
  };
  // Una fila por recinto, para el CSV.
  detalle: FilaRecinto[];
}

export function cifras(
  requerido: number,
  ingresados: number,
  verificados: number,
): Cifras {
  const cobertura = pct(ingresados, requerido);
  return {
    requerido,
    ingresados,
    verificados,
    faltan: Math.max(0, requerido - ingresados),
    pct: cobertura,
    pctFaltante: requerido > 0 ? Math.round((100 - cobertura) * 10) / 10 : 0,
  };
}

type RolCifras = keyof CifrasPorRol;

// Suma las cifras de varias filas y recalcula los porcentajes con los totales,
// nunca promediando los de cada fila.
export function sumar(filas: CifrasPorRol[]): CifrasPorRol {
  const suma = (rol: RolCifras) =>
    cifras(
      filas.reduce((a, f) => a + f[rol].requerido, 0),
      filas.reduce((a, f) => a + f[rol].ingresados, 0),
      filas.reduce((a, f) => a + f[rol].verificados, 0),
    );
  return {
    veedores: suma("veedores"),
    coordinadores: suma("coordinadores"),
    cda: suma("cda"),
    completa: suma("completa"),
  };
}

export function armarInforme(entrada: EntradaInforme): Informe {
  const { recintos, parroquias, veedores, coordinadores, acreditados } =
    entrada;
  const porCodigo = new Map(parroquias.map((p) => [p.properties.code, p]));

  const vPorRecinto = agruparPor(veedores, (v) => v.recintoCodigo);
  const cPorRecinto = agruparPor(coordinadores, (c) => c.recintoCodigo);
  const aPorRecinto = agruparPor(acreditados, (a) => a.recintoCodigo);
  const cobertura = calcularCobertura(
    recintos,
    veedores,
    coordinadores,
    acreditados,
  );
  const coberturaDe = new Map(cobertura.map((c) => [c.recintoCodigo, c]));

  const filas = recintos.map((recinto) => ({
    recinto,
    consolidado: consolidarRecinto(
      recinto,
      (cPorRecinto.get(recinto.cod) ?? []) as Coordinador[],
      (aPorRecinto.get(recinto.cod) ?? []) as AcreditadoCda[],
      (vPorRecinto.get(recinto.cod) ?? []) as Veedor[],
    ),
    cobertura: coberturaDe.get(recinto.cod)!,
  }));

  const totalJuntas = filas.reduce(
    (a, f) => a + f.consolidado.juntas.length,
    0,
  );
  const recintosCda = recintos.filter((r) => r.cda).length;
  const cubiertas = cobertura.reduce((a, c) => a + c.juntasCubiertas, 0);
  const cubiertasVerificadas = cobertura.reduce(
    (a, c) => a + c.juntasCubiertasVerificado,
    0,
  );

  // Cifras de un recinto: veedores por junta, coordinador y CDA por recinto.
  const detalle: FilaRecinto[] = filas
    .map((f): FilaRecinto => {
      const c = f.consolidado;
      const estado: EstadoRecinto = c.completo
        ? "completo"
        : c.casiCompleto
          ? "casi"
          : "pendiente";
      const parroquia = porCodigo.get(f.recinto.par);
      return {
        codigo: f.recinto.cod,
        parroquiaCodigo: f.recinto.par,
        parroquia: parroquia?.properties.name ?? "",
        urbana: parroquia?.properties.urbana ?? false,
        recinto: f.recinto.nombre,
        esCda: f.recinto.cda,
        estado,
        veedores: cifras(
          c.juntas.length,
          c.juntasConTitular,
          c.juntas.filter((j) => j.puesto.titular?.verificado).length,
        ),
        coordinadores: cifras(
          1,
          c.coordinador.titular ? 1 : 0,
          c.coordinador.titular?.verificado ? 1 : 0,
        ),
        cda: cifras(
          f.recinto.cda ? 1 : 0,
          c.cda?.titular ? 1 : 0,
          c.cda?.titular?.verificado ? 1 : 0,
        ),
        completa: cifras(
          c.juntas.length,
          f.cobertura.juntasCubiertas,
          f.cobertura.juntasCubiertasVerificado,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.parroquia.localeCompare(b.parroquia) ||
        a.recinto.localeCompare(b.recinto),
    );

  const todas: FilaParroquia[] = parroquias.map((p) => {
    const recintosDe = detalle.filter(
      (d) => d.parroquiaCodigo === p.properties.code,
    );
    return {
      codigo: p.properties.code,
      nombre: p.properties.name,
      urbana: p.properties.urbana,
      recintos: recintosDe,
      ...sumar(recintosDe),
    };
  });
  const ordenar = (a: FilaParroquia, b: FilaParroquia) =>
    b.veedores.requerido - a.veedores.requerido ||
    a.nombre.localeCompare(b.nombre);
  const urbanas = todas.filter((p) => p.urbana).sort(ordenar);
  const rurales = todas.filter((p) => !p.urbana).sort(ordenar);
  const total = sumar(detalle);

  // Dónde actuar primero: recintos con veedores pero sin coordinador.
  const esperando = filas
    .filter(
      (f) =>
        !f.consolidado.coordinador.titular &&
        f.consolidado.juntasConTitular > 0,
    )
    .map((f) => ({
      recintoCodigo: f.recinto.cod,
      recinto: f.recinto.nombre,
      parroquia: porCodigo.get(f.recinto.par)?.properties.name ?? "",
      desbloquea: f.consolidado.juntasConTitular,
      totalJuntas: f.consolidado.juntas.length,
    }))
    .sort(
      (a, b) =>
        b.desbloquea - a.desbloquea || a.recinto.localeCompare(b.recinto),
    );
  let acumulado = 0;
  const acciones: AccionPrioritaria[] = esperando.map((e) => {
    acumulado += e.desbloquea;
    return {
      ...e,
      acumulado,
      pctAcumulado: pct(cubiertas + acumulado, totalJuntas),
    };
  });

  // Dónde faltan veedores: recintos que ya tienen coordinador, donde cada
  // veedor titular nuevo suma una junta cubierta de inmediato.
  const accionesVeedores: AccionVeedores[] = filas
    .filter(
      (f) =>
        f.consolidado.coordinador.titular && f.consolidado.juntasSinTitular > 0,
    )
    .map((f) => ({
      recintoCodigo: f.recinto.cod,
      recinto: f.recinto.nombre,
      parroquia: porCodigo.get(f.recinto.par)?.properties.name ?? "",
      sinVeedor: f.consolidado.juntasSinTitular,
      totalJuntas: f.consolidado.juntas.length,
    }))
    .sort(
      (a, b) => b.sinVeedor - a.sinVeedor || a.recinto.localeCompare(b.recinto),
    );

  // Ritmo: mismo cálculo del Resumen (puestos que se necesitan menos las
  // personas únicas registradas, en Militancia o ya asignadas).
  const puestosNecesarios = totalJuntas + recintos.length + recintosCda;
  const cedulas = new Set(
    [...entrada.militantes, ...veedores, ...coordinadores, ...acreditados]
      .map((p) => p.cedula.trim())
      .filter(Boolean),
  );
  const faltan = Math.max(0, puestosNecesarios - cedulas.size);

  const rol = (
    clave: FilaRol["clave"],
    etiqueta: string,
    c: Cifras,
  ): FilaRol => ({ clave, etiqueta, ...c });

  return {
    corte: entrada.ahora,
    totales: {
      juntas: totalJuntas,
      recintos: recintos.length,
      recintosCda,
    },
    cobertura: {
      cubiertas,
      cubiertasVerificadas,
      pct: pct(cubiertas, totalJuntas),
      pctVerificadas: pct(cubiertasVerificadas, totalJuntas),
    },
    roles: [
      rol("veedores", "Veedores", total.veedores),
      rol("coordinadores", "Coordinadores", total.coordinadores),
      rol("cda", "Acreditados CDA", total.cda),
      rol("completa", "Juntas con cobertura completa", total.completa),
    ],
    urbanas,
    rurales,
    subtotalUrbanas: sumar(urbanas),
    subtotalRurales: sumar(rurales),
    total,
    acciones,
    accionesVeedores,
    militancia: {
      total: entrada.militantes.length,
      incorrectos: entrada.militantes.filter((m) => m.incorrecto).length,
      duplicados: entrada.militantes.filter((m) => m.duplicado).length,
      repetidosAsignados: entrada.militantes.filter((m) => m.asignado).length,
      conRecinto: entrada.militantes.filter((m) => m.recintoCodigo != null)
        .length,
    },
    ritmo: {
      puestosNecesarios,
      personasUnicas: cedulas.size,
      faltan,
      cuenta: calcularCuentaRegresiva(entrada.ahora, ELECCIONES_INICIO, faltan),
    },
    detalle,
  };
}
