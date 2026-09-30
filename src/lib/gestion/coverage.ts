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
      pctVeedores: pct(juntasConVeedorAqui, juntas.length),
      pctVeedoresVerificado: pct(juntasConVeedorVerificadoAqui, juntas.length),
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

// Progreso informativo por parroquia para el mapa público: cuántas juntas
// tienen veedor titular asignado y cuántos recintos tienen coordinador
// titular asignado, cada uno independiente del otro (a diferencia de
// calcularCobertura(), que exige ambos para contar una junta como cubierta).
// Los campos "*Verificado" son, sobre el mismo total, cuántos de esos
// titulares ya fueron contactados. Los campos "*Cda" solo cuentan sobre los
// recintos CDA de la parroquia (totalRecintosCda puede ser 0).
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
      juntasConVeedor: 0,
      juntasConVeedorVerificado: 0,
      pctVeedores: 0,
      pctVeedoresVerificado: 0,
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
    entry.juntasConVeedor += juntas.filter((j) => juntasConTitular.has(j.id)).length;
    entry.juntasConVeedorVerificado += juntas.filter((j) =>
      juntasConTitularVerificado.has(j.id),
    ).length;
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
    entry.pctVeedores = pct(entry.juntasConVeedor, entry.totalJuntas);
    entry.pctVeedoresVerificado = pct(
      entry.juntasConVeedorVerificado,
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
  const juntasConVeedor = sumar((p) => p.juntasConVeedor);
  const juntasConVeedorVerificado = sumar((p) => p.juntasConVeedorVerificado);
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
    juntasConVeedor,
    juntasConVeedorVerificado,
    pctVeedores: pct(juntasConVeedor, totalJuntas),
    pctVeedoresVerificado: pct(juntasConVeedorVerificado, totalJuntas),
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

// Extrae el par (pct, pctVerificado) correspondiente a un track, tanto para
// el agregado de cantón como para una fila de CoberturaParroquia (misma
// forma de campos en ambos tipos).
export function extraerPct(
  track: CoberturaTrack,
  c: CoberturaCanton | CoberturaParroquia,
): { pct: number; pctVerificado: number } {
  if (track === "veedores") {
    return { pct: c.pctVeedores, pctVerificado: c.pctVeedoresVerificado };
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
    return { pct: r.pctVeedores, pctVerificado: r.pctVeedoresVerificado };
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
      cubiertos: c.juntasConVeedor,
      verificados: c.juntasConVeedorVerificado,
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
