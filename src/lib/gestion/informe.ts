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
  // Juntas sin veedor titular y recintos CDA de la parroquia con su titular.
  sinVeedor: number;
  recintosCda: number;
  cdaConTitular: number;
  // Recintos de la parroquia, ordenados por nombre, para el desglose.
  detalle: FilaDetalle[];
}

export interface Subtotal {
  juntas: number;
  conVeedor: number;
  cubiertas: number;
  pct: number;
  recintos: number;
  conCoordinador: number;
  sinVeedor: number;
  recintosCda: number;
  cdaConTitular: number;
}

export type EstadoRecinto = "completo" | "casi" | "pendiente";

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

export interface FilaDetalle {
  codigo: number;
  parroquiaCodigo: number;
  parroquia: string;
  urbana: boolean;
  recinto: string;
  juntas: number;
  juntasConVeedor: number;
  juntasSinVeedor: number;
  veedoresTotal: number;
  coordinador: boolean;
  cubiertas: number;
  pct: number;
  esCda: boolean;
  cdaTitular: boolean;
  estado: EstadoRecinto;
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
  // Lo que falta para cubrir el cantón, en puestos titulares.
  brechas: {
    juntasSinVeedor: number;
    recintosSinCoordinador: number;
    recintosCdaSinTitular: number;
    // Recintos sin un solo veedor titular ni coordinador: partir de cero.
    recintosSinNada: number;
  };
  accionesVeedores: AccionVeedores[];
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
      // Personas pendientes que ya traen recinto, listas para asignar.
      conRecinto: number;
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

function titularesConJunta(
  filas: { consolidado: { juntasConTitular: number } }[],
): number {
  return filas.reduce((a, f) => a + f.consolidado.juntasConTitular, 0);
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
    sinVeedor: filas.reduce((a, f) => a + f.sinVeedor, 0),
    recintosCda: filas.reduce((a, f) => a + f.recintosCda, 0),
    cdaConTitular: filas.reduce((a, f) => a + f.cdaConTitular, 0),
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

  const estadoDe = (f: (typeof filas)[number]): EstadoRecinto =>
    f.consolidado.completo
      ? "completo"
      : f.consolidado.casiCompleto
        ? "casi"
        : "pendiente";
  const detalle: FilaDetalle[] = filas
    .map((f) => ({
      codigo: f.recinto.cod,
      parroquiaCodigo: f.recinto.par,
      parroquia: porCodigo.get(f.recinto.par)?.properties.name ?? "",
      urbana: porCodigo.get(f.recinto.par)?.properties.urbana ?? false,
      recinto: f.recinto.nombre,
      juntas: f.consolidado.juntas.length,
      juntasConVeedor: f.consolidado.juntasConTitular,
      juntasSinVeedor: f.consolidado.juntasSinTitular,
      veedoresTotal: f.consolidado.veedoresTotal,
      coordinador: f.consolidado.coordinador.titular !== null,
      cubiertas: f.cobertura.juntasCubiertas,
      pct: f.cobertura.pct,
      esCda: f.recinto.cda,
      cdaTitular: f.consolidado.cda?.titular != null,
      estado: estadoDe(f),
    }))
    .sort(
      (a, b) =>
        a.parroquia.localeCompare(b.parroquia) ||
        a.recinto.localeCompare(b.recinto),
    );

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
      sinVeedor: 0,
      recintosCda: 0,
      cdaConTitular: 0,
      detalle: detalle.filter((d) => d.parroquiaCodigo === p.properties.code),
    });
  }
  for (const f of filas) {
    const p = porParroquia.get(f.recinto.par);
    if (!p) continue;
    p.juntas += f.consolidado.juntas.length;
    p.conVeedor += f.consolidado.juntasConTitular;
    p.cubiertas += f.cobertura.juntasCubiertas;
    p.recintos += 1;
    p.sinVeedor += f.consolidado.juntasSinTitular;
    if (f.consolidado.coordinador.titular) p.conCoordinador += 1;
    if (f.recinto.cda) {
      p.recintosCda += 1;
      if (f.consolidado.cda?.titular) p.cdaConTitular += 1;
    }
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
  const brechas = {
    juntasSinVeedor: totalJuntas - titularesConJunta(filas),
    recintosSinCoordinador: filas.filter(
      (f) => !f.consolidado.coordinador.titular,
    ).length,
    recintosCdaSinTitular: filas.filter(
      (f) => f.recinto.cda && !f.consolidado.cda?.titular,
    ).length,
    recintosSinNada: filas.filter(
      (f) =>
        !f.consolidado.coordinador.titular &&
        f.consolidado.juntasConTitular === 0,
    ).length,
  };

  // Ritmo: mismo cálculo del Resumen (puestos que se necesitan menos las
  // personas únicas registradas, en Militancia o ya asignadas).
  const puestosNecesarios = totalJuntas + recintos.length + recintosCda;
  const cedulas = new Set(
    [...entrada.militantes, ...veedores, ...coordinadores, ...acreditados]
      .map((p) => p.cedula.trim())
      .filter(Boolean),
  );
  const faltan = Math.max(0, puestosNecesarios - cedulas.size);

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
    brechas,
    accionesVeedores,
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
        conRecinto: entrada.militantes.filter((m) => m.recintoCodigo != null)
          .length,
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
