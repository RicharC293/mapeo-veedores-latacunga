import type { ParroquiaFeature, Recinto } from "../types";
import { listJuntasDeRecinto } from "./juntas";
import type {
  AcreditadoCda,
  Coordinador,
  CoberturaCanton,
  CoberturaParroquia,
  CoberturaRecinto,
  CoberturaTrack,
  Veedor,
} from "./types";

export function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

export function calcularCobertura(
  recintos: Recinto[],
  veedores: Veedor[],
  coordinadores: Coordinador[],
  acreditadosCda: AcreditadoCda[],
): CoberturaRecinto[] {
  const titulares = veedores.filter((v) => v.tipo === "titular");
  const juntasConTitular = new Set(titulares.map((v) => v.juntaId));
  const juntasConTitularVerificado = new Set(
    titulares.filter((v) => v.verificado).map((v) => v.juntaId),
  );

  const coordTitulares = coordinadores.filter((c) => c.tipo === "titular");
  const recintosConCoordinadorTitular = new Set(
    coordTitulares.map((c) => c.recintoCodigo),
  );
  const recintosConCoordinadorVerificado = new Set(
    coordTitulares.filter((c) => c.verificado).map((c) => c.recintoCodigo),
  );

  const cdaTitulares = acreditadosCda.filter((a) => a.tipo === "titular");
  const recintosConCdaTitular = new Set(
    cdaTitulares.map((a) => a.recintoCodigo),
  );
  const recintosConCdaVerificado = new Set(
    cdaTitulares.filter((a) => a.verificado).map((a) => a.recintoCodigo),
  );

  return recintos.map((recinto) => {
    const juntas = listJuntasDeRecinto(recinto);
    const tieneCoordinadorTitular = recintosConCoordinadorTitular.has(recinto.cod);
    const tieneCoordinadorVerificado = recintosConCoordinadorVerificado.has(recinto.cod);
    const juntasConVeedorAqui = juntas.filter((j) => juntasConTitular.has(j.id)).length;
    const juntasConVeedorVerificadoAqui = juntas.filter((j) =>
      juntasConTitularVerificado.has(j.id),
    ).length;
    const juntasCubiertas = tieneCoordinadorTitular ? juntasConVeedorAqui : 0;
    const juntasCubiertasVerificado = tieneCoordinadorVerificado
      ? juntasConVeedorVerificadoAqui
      : 0;
    const tieneCdaTitular = recintosConCdaTitular.has(recinto.cod);
    const tieneCdaVerificado = recintosConCdaVerificado.has(recinto.cod);
    return {
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      totalJuntas: juntas.length,
      juntasCubiertas,
      tieneCoordinadorTitular,
      pct: pct(juntasCubiertas, juntas.length),
      juntasCubiertasVerificado,
      tieneCoordinadorVerificado,
      pctVerificado: pct(juntasCubiertasVerificado, juntas.length),
      pctCoordinador: tieneCoordinadorTitular ? 100 : 0,
      pctCoordinadorVerificado: tieneCoordinadorVerificado ? 100 : 0,
      cdaAplica: recinto.cda,
      tieneCdaTitular,
      tieneCdaVerificado,
      pctCda: recinto.cda && tieneCdaTitular ? 100 : 0,
      pctCdaVerificado: recinto.cda && tieneCdaVerificado ? 100 : 0,
    };
  });
}

// Progreso por parroquia para el mapa público y las gráficas. La cobertura de
// veedores es la completa: una junta cuenta como cubierta si tiene veedor
// titular Y su recinto tiene coordinador titular (igual que calcularCobertura()).
// Los recintos con coordinador y los recintos CDA con acreditado se cuentan
// aparte, cada uno sobre su propio total. Los campos "*Verificado" son, sobre
// el mismo total, cuántos de esos titulares ya fueron contactados; los
// "*Cda" solo cuentan sobre los recintos CDA de la parroquia
// (totalRecintosCda puede ser 0).
export function calcularCoberturaPorParroquia(
  parroquias: ParroquiaFeature[],
  recintos: Recinto[],
  veedores: Veedor[],
  coordinadores: Coordinador[],
  acreditadosCda: AcreditadoCda[],
): Record<number, CoberturaParroquia> {
  const titulares = veedores.filter((v) => v.tipo === "titular");
  const juntasConTitular = new Set(titulares.map((v) => v.juntaId));
  const juntasConTitularVerificado = new Set(
    titulares.filter((v) => v.verificado).map((v) => v.juntaId),
  );

  const coordTitulares = coordinadores.filter((c) => c.tipo === "titular");
  const recintosConCoordinadorTitular = new Set(
    coordTitulares.map((c) => c.recintoCodigo),
  );
  const recintosConCoordinadorVerificado = new Set(
    coordTitulares.filter((c) => c.verificado).map((c) => c.recintoCodigo),
  );

  const cdaTitulares = acreditadosCda.filter((a) => a.tipo === "titular");
  const recintosConCdaTitular = new Set(
    cdaTitulares.map((a) => a.recintoCodigo),
  );
  const recintosConCdaVerificado = new Set(
    cdaTitulares.filter((a) => a.verificado).map((a) => a.recintoCodigo),
  );

  const resultado: Record<number, CoberturaParroquia> = {};
  for (const f of parroquias) {
    resultado[f.properties.code] = {
      parroquiaCodigo: f.properties.code,
      totalJuntas: 0,
      juntasCubiertas: 0,
      juntasCubiertasVerificado: 0,
      pctCobertura: 0,
      pctCoberturaVerificada: 0,
      totalRecintos: 0,
      recintosConCoordinador: 0,
      recintosConCoordinadorVerificado: 0,
      pctCoordinador: 0,
      pctCoordinadorVerificado: 0,
      totalRecintosCda: 0,
      recintosConCda: 0,
      recintosConCdaVerificado: 0,
      pctCda: 0,
      pctCdaVerificado: 0,
    };
  }

  for (const recinto of recintos) {
    const entry = resultado[recinto.par];
    if (!entry) continue;
    const juntas = listJuntasDeRecinto(recinto);
    entry.totalJuntas += juntas.length;
    // Una junta solo cuenta como cubierta si su recinto tiene coordinador
    // titular (y, "Verificado", si ambos ya fueron contactados).
    if (recintosConCoordinadorTitular.has(recinto.cod)) {
      entry.juntasCubiertas += juntas.filter((j) =>
        juntasConTitular.has(j.id),
      ).length;
    }
    if (recintosConCoordinadorVerificado.has(recinto.cod)) {
      entry.juntasCubiertasVerificado += juntas.filter((j) =>
        juntasConTitularVerificado.has(j.id),
      ).length;
    }
    entry.totalRecintos += 1;
    if (recintosConCoordinadorTitular.has(recinto.cod)) entry.recintosConCoordinador += 1;
    if (recintosConCoordinadorVerificado.has(recinto.cod))
      entry.recintosConCoordinadorVerificado += 1;
    if (recinto.cda) {
      entry.totalRecintosCda += 1;
      if (recintosConCdaTitular.has(recinto.cod)) entry.recintosConCda += 1;
      if (recintosConCdaVerificado.has(recinto.cod))
        entry.recintosConCdaVerificado += 1;
    }
  }

  for (const entry of Object.values(resultado)) {
    entry.pctCobertura = pct(entry.juntasCubiertas, entry.totalJuntas);
    entry.pctCoberturaVerificada = pct(
      entry.juntasCubiertasVerificado,
      entry.totalJuntas,
    );
    entry.pctCoordinador = pct(entry.recintosConCoordinador, entry.totalRecintos);
    entry.pctCoordinadorVerificado = pct(
      entry.recintosConCoordinadorVerificado,
      entry.totalRecintos,
    );
    entry.pctCda = pct(entry.recintosConCda, entry.totalRecintosCda);
    entry.pctCdaVerificado = pct(
      entry.recintosConCdaVerificado,
      entry.totalRecintosCda,
    );
  }

  return resultado;
}

// Agrega el mapa por parroquia (ya calculado) en un solo total de cantón.
// No hay ningún otro lugar del código que sume "todo el cantón" hoy: se
// arma aquí en vez de recalcular desde cero los veedores/coordinadores/CDA.
export function calcularCoberturaCanton(
  porParroquia: Record<number, CoberturaParroquia>,
): CoberturaCanton {
  const valores = Object.values(porParroquia);
  const sumar = (f: (p: CoberturaParroquia) => number) =>
    valores.reduce((acc, p) => acc + f(p), 0);

  const totalJuntas = sumar((p) => p.totalJuntas);
  const juntasCubiertas = sumar((p) => p.juntasCubiertas);
  const juntasCubiertasVerificado = sumar((p) => p.juntasCubiertasVerificado);
  const totalRecintos = sumar((p) => p.totalRecintos);
  const recintosConCoordinador = sumar((p) => p.recintosConCoordinador);
  const recintosConCoordinadorVerificado = sumar(
    (p) => p.recintosConCoordinadorVerificado,
  );
  const totalRecintosCda = sumar((p) => p.totalRecintosCda);
  const recintosConCda = sumar((p) => p.recintosConCda);
  const recintosConCdaVerificado = sumar((p) => p.recintosConCdaVerificado);

  return {
    totalJuntas,
    juntasCubiertas,
    juntasCubiertasVerificado,
    pctCobertura: pct(juntasCubiertas, totalJuntas),
    pctCoberturaVerificada: pct(juntasCubiertasVerificado, totalJuntas),
    totalRecintos,
    recintosConCoordinador,
    recintosConCoordinadorVerificado,
    pctCoordinador: pct(recintosConCoordinador, totalRecintos),
    pctCoordinadorVerificado: pct(
      recintosConCoordinadorVerificado,
      totalRecintos,
    ),
    totalRecintosCda,
    recintosConCda,
    recintosConCdaVerificado,
    pctCda: pct(recintosConCda, totalRecintosCda),
    pctCdaVerificado: pct(recintosConCdaVerificado, totalRecintosCda),
  };
}

// Cobertura de un grupo de parroquias (por ejemplo "las urbanas"): suma los
// conteos reales de cada una y saca la proporción sobre el total del grupo.
// Nunca se promedian los porcentajes de cada parroquia: una con 1 junta al
// 100 % pesaría lo mismo que una con 60 juntas al 5 %.
export function calcularCoberturaGrupo(
  porParroquia: Record<number, CoberturaParroquia>,
  codigos: number[],
): CoberturaCanton {
  const subconjunto: Record<number, CoberturaParroquia> = {};
  for (const codigo of codigos) {
    if (porParroquia[codigo]) subconjunto[codigo] = porParroquia[codigo];
  }
  return calcularCoberturaCanton(subconjunto);
}

// Extrae el par (pct, pctVerificado) correspondiente a un track, tanto para
// el agregado de cantón como para una fila de CoberturaParroquia (misma
// forma de campos en ambos tipos).
export function extraerPct(
  track: CoberturaTrack,
  c: CoberturaCanton | CoberturaParroquia,
): { pct: number; pctVerificado: number } {
  if (track === "veedores") {
    return { pct: c.pctCobertura, pctVerificado: c.pctCoberturaVerificada };
  }
  if (track === "coordinadores") {
    return { pct: c.pctCoordinador, pctVerificado: c.pctCoordinadorVerificado };
  }
  return { pct: c.pctCda, pctVerificado: c.pctCdaVerificado };
}

// Igual que extraerPct, pero para una fila de CoberturaRecinto. Devuelve
// null cuando el track es "cda" y el recinto no es un CDA (se excluye del
// gráfico en vez de mostrar un 0% engañoso).
export function extraerPctRecinto(
  track: CoberturaTrack,
  r: CoberturaRecinto,
): { pct: number; pctVerificado: number } | null {
  if (track === "veedores") {
    return { pct: r.pct, pctVerificado: r.pctVerificado };
  }
  if (track === "coordinadores") {
    return { pct: r.pctCoordinador, pctVerificado: r.pctCoordinadorVerificado };
  }
  if (!r.cdaAplica) return null;
  return { pct: r.pctCda, pctVerificado: r.pctCdaVerificado };
}

// Totales crudos (numerador/denominador) del track, usados por el donut de
// cobertura y por los tooltips de las barras (más informativos que solo el
// porcentaje).
export function totalesDeTrack(
  track: CoberturaTrack,
  c: CoberturaCanton,
): { total: number; cubiertos: number; verificados: number } {
  if (track === "veedores") {
    return {
      total: c.totalJuntas,
      cubiertos: c.juntasCubiertas,
      verificados: c.juntasCubiertasVerificado,
    };
  }
  if (track === "coordinadores") {
    return {
      total: c.totalRecintos,
      cubiertos: c.recintosConCoordinador,
      verificados: c.recintosConCoordinadorVerificado,
    };
  }
  return {
    total: c.totalRecintosCda,
    cubiertos: c.recintosConCda,
    verificados: c.recintosConCdaVerificado,
  };
}
