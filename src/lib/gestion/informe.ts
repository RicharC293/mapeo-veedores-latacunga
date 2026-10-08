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

export interface FilaRol {
  clave: "veedores" | "coordinadores" | "cda" | "completa";
  etiqueta: string;
  // Lo que hace falta: juntas, recintos o recintos CDA.
  necesarios: number;
  registrados: number;
  verificados: number;
  pct: number;
  pctVerificados: number;
}

export interface FilaParroquia {
  codigo: number;
  nombre: string;
  urbana: boolean;
  juntas: number;
  // Juntas con veedor titular, sin mirar el coordinador.
  conVeedor: number;
  // Juntas cubiertas: con veedor titular y coordinador en su recinto.
  cubiertas: number;
  pct: number;
  recintos: number;
  conCoordinador: number;
}

export interface Subtotal {
  juntas: number;
  conVeedor: number;
  cubiertas: number;
  pct: number;
  recintos: number;
  conCoordinador: number;
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

export interface FilaDetalle {
  parroquia: string;
  urbana: boolean;
  recinto: string;
  juntas: number;
  juntasConVeedor: number;
  veedoresTotal: number;
  coordinador: boolean;
  cubiertas: number;
  pct: number;
  esCda: boolean;
  cdaTitular: boolean;
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
  // De los veedores titulares registrados a las juntas cubiertas.
  cascada: {
    registrados: number;
    cubiertos: number;
    esperandoCoordinador: number;
    recintosEsperando: number;
  };
  urbanas: FilaParroquia[];
  rurales: FilaParroquia[];
  subtotalUrbanas: Subtotal;
  subtotalRurales: Subtotal;
  total: Subtotal;
  acciones: AccionPrioritaria[];
  calidad: {
    veedoresSuplentes: number;
    recintosConExcedente: number;
    recintosCasiCompletos: number;
    recintosCompletos: number;
    militancia: {
      total: number;
      incorrectos: number;
      duplicados: number;
      repetidosAsignados: number;
    };
  };
  ritmo: {
    puestosNecesarios: number;
    personasUnicas: number;
    faltan: number;
    cuenta: CuentaRegresiva;
  };
  detalle: FilaDetalle[];
}

function subtotal(filas: FilaParroquia[]): Subtotal {
  const juntas = filas.reduce((a, f) => a + f.juntas, 0);
  const cubiertas = filas.reduce((a, f) => a + f.cubiertas, 0);
  return {
    juntas,
    conVeedor: filas.reduce((a, f) => a + f.conVeedor, 0),
    cubiertas,
    pct: pct(cubiertas, juntas),
    recintos: filas.reduce((a, f) => a + f.recintos, 0),
    conCoordinador: filas.reduce((a, f) => a + f.conCoordinador, 0),
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

  const titularesVeedor = veedores.filter((v) => v.tipo === "titular");
  const titularesCoord = coordinadores.filter((c) => c.tipo === "titular");
  const titularesCda = acreditados.filter((a) => a.tipo === "titular");
  const rol = (
    clave: FilaRol["clave"],
    etiqueta: string,
    necesarios: number,
    registrados: number,
    verificados: number,
  ): FilaRol => ({
    clave,
    etiqueta,
    necesarios,
    registrados,
    verificados,
    pct: pct(registrados, necesarios),
    pctVerificados: pct(verificados, necesarios),
  });

  // Por parroquia
  const porParroquia = new Map<number, FilaParroquia>();
  for (const p of parroquias) {
    porParroquia.set(p.properties.code, {
      codigo: p.properties.code,
      nombre: p.properties.name,
      urbana: p.properties.urbana,
      juntas: 0,
      conVeedor: 0,
      cubiertas: 0,
      pct: 0,
      recintos: 0,
      conCoordinador: 0,
    });
  }
  for (const f of filas) {
    const p = porParroquia.get(f.recinto.par);
    if (!p) continue;
    p.juntas += f.consolidado.juntas.length;
    p.conVeedor += f.consolidado.juntasConTitular;
    p.cubiertas += f.cobertura.juntasCubiertas;
    p.recintos += 1;
    if (f.consolidado.coordinador.titular) p.conCoordinador += 1;
  }
  const todas = [...porParroquia.values()].map((p) => ({
    ...p,
    pct: pct(p.cubiertas, p.juntas),
  }));
  const ordenar = (a: FilaParroquia, b: FilaParroquia) =>
    b.juntas - a.juntas || a.nombre.localeCompare(b.nombre);
  const urbanas = todas.filter((p) => p.urbana).sort(ordenar);
  const rurales = todas.filter((p) => !p.urbana).sort(ordenar);

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
  const esperandoCoordinador = esperando.reduce((a, e) => a + e.desbloquea, 0);

  // Ritmo: mismo cálculo del Resumen (puestos que se necesitan menos las
  // personas únicas registradas, en Militancia o ya asignadas).
  const puestosNecesarios = totalJuntas + recintos.length + recintosCda;
  const cedulas = new Set(
    [...entrada.militantes, ...veedores, ...coordinadores, ...acreditados]
      .map((p) => p.cedula.trim())
      .filter(Boolean),
  );
  const faltan = Math.max(0, puestosNecesarios - cedulas.size);

  const detalle: FilaDetalle[] = filas
    .map((f) => ({
      parroquia: porCodigo.get(f.recinto.par)?.properties.name ?? "",
      urbana: porCodigo.get(f.recinto.par)?.properties.urbana ?? false,
      recinto: f.recinto.nombre,
      juntas: f.consolidado.juntas.length,
      juntasConVeedor: f.consolidado.juntasConTitular,
      veedoresTotal: f.consolidado.veedoresTotal,
      coordinador: f.consolidado.coordinador.titular !== null,
      cubiertas: f.cobertura.juntasCubiertas,
      pct: f.cobertura.pct,
      esCda: f.recinto.cda,
      cdaTitular: f.consolidado.cda?.titular != null,
    }))
    .sort(
      (a, b) =>
        a.parroquia.localeCompare(b.parroquia) ||
        a.recinto.localeCompare(b.recinto),
    );

  return {
    corte: entrada.ahora,
    totales: {
      juntas: totalJuntas,
      recintos: recintos.length,
      recintosCda,
    },
    cobertura: {
      cubiertas,
      cubiertasVerificadas: cubiertasVerificadas,
      pct: pct(cubiertas, totalJuntas),
      pctVerificadas: pct(cubiertasVerificadas, totalJuntas),
    },
    roles: [
      rol(
        "veedores",
        "Veedores titulares",
        totalJuntas,
        titularesVeedor.length,
        titularesVeedor.filter((v) => v.verificado).length,
      ),
      rol(
        "coordinadores",
        "Coordinadores titulares",
        recintos.length,
        titularesCoord.length,
        titularesCoord.filter((c) => c.verificado).length,
      ),
      rol(
        "cda",
        "Acreditados CDA titulares",
        recintosCda,
        titularesCda.length,
        titularesCda.filter((a) => a.verificado).length,
      ),
      rol(
        "completa",
        "Juntas con cobertura completa",
        totalJuntas,
        cubiertas,
        cubiertasVerificadas,
      ),
    ],
    cascada: {
      registrados: titularesVeedor.length,
      cubiertos: cubiertas,
      esperandoCoordinador,
      recintosEsperando: esperando.length,
    },
    urbanas,
    rurales,
    subtotalUrbanas: subtotal(urbanas),
    subtotalRurales: subtotal(rurales),
    total: subtotal(todas),
    acciones,
    calidad: {
      veedoresSuplentes: veedores.filter((v) => v.tipo === "suplente").length,
      recintosConExcedente: filas.filter((f) => f.consolidado.excedente > 0)
        .length,
      recintosCasiCompletos: filas.filter((f) => f.consolidado.casiCompleto)
        .length,
      recintosCompletos: filas.filter((f) => f.consolidado.completo).length,
      militancia: {
        total: entrada.militantes.length,
        incorrectos: entrada.militantes.filter((m) => m.incorrecto).length,
        duplicados: entrada.militantes.filter((m) => m.duplicado).length,
        repetidosAsignados: entrada.militantes.filter((m) => m.asignado).length,
      },
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
