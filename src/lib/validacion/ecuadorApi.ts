// Consulta de una cédula en ecuadorapi.com. Cada consulta tiene costo, así
// que esta función solo clasifica la respuesta; quién decide qué consultar y
// cuándo detenerse es validaciones.ts.

export const PROVEEDOR = "ecuadorapi";
export const URL_BASE = "https://api.ecuadorapi.com/api/v1/cedulas";
// Precio por consulta en dólares, para estimar el costo antes de consultar.
export const COSTO_POR_CONSULTA = 0.02;

export type EstadoValidacion = "validada" | "no_encontrada" | "error";

export interface ResultadoConsulta {
  estado: EstadoValidacion;
  httpStatus: number | null;
  // Cuerpo de la respuesta tal como llegó (se guarda íntegro).
  respuesta: unknown;
  nombres: string | null;
  apellidos: string | null;
  nombreCompleto: string | null;
  // Fecha de nacimiento (AAAA-MM-DD) y género tal como los da la API.
  fechaNacimiento: string | null;
  genero: string | null;
  error: string | null;
  // true si no tiene sentido seguir consultando en esta corrida (clave
  // inválida, sin saldo o demasiadas consultas): seguir solo gastaría.
  detener: boolean;
}

interface CuerpoApi {
  data?: {
    id?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    gender?: string;
  } | null;
  error?: unknown;
  message?: unknown;
}

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

function mensajeDe(cuerpo: CuerpoApi | null, status: number): string {
  return (
    texto(cuerpo?.message) ??
    texto(cuerpo?.error) ??
    `La API respondió con el código ${status}.`
  );
}

export async function consultarCedula(
  cedula: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  urlBase: string = URL_BASE,
): Promise<ResultadoConsulta> {
  const base = {
    nombres: null,
    apellidos: null,
    nombreCompleto: null,
    fechaNacimiento: null,
    genero: null,
  };
  let res: Response;
  try {
    res = await fetchFn(`${urlBase}/${encodeURIComponent(cedula)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    return {
      ...base,
      estado: "error",
      httpStatus: null,
      respuesta: null,
      error: `No se pudo conectar con la API: ${err instanceof Error ? err.message : "error de red"}.`,
      detener: false,
    };
  }

  let cuerpo: CuerpoApi | null;
  try {
    cuerpo = (await res.json()) as CuerpoApi;
  } catch {
    cuerpo = null;
  }

  // Clave inválida, sin saldo o límite de consultas: se detiene la corrida.
  if ([401, 402, 403, 429].includes(res.status)) {
    const motivo =
      res.status === 429
        ? "La API pide esperar: demasiadas consultas seguidas."
        : res.status === 402
          ? "La cuenta de la API no tiene saldo."
          : "La clave de la API no es válida o no tiene permiso.";
    return {
      ...base,
      estado: "error",
      httpStatus: res.status,
      respuesta: cuerpo,
      error: `${motivo} ${mensajeDe(cuerpo, res.status)}`.trim(),
      detener: true,
    };
  }

  const datos = cuerpo?.data;
  if (res.ok && datos && (texto(datos.full_name) || texto(datos.first_name))) {
    return {
      estado: "validada",
      httpStatus: res.status,
      respuesta: cuerpo,
      nombres: texto(datos.first_name),
      apellidos: texto(datos.last_name),
      nombreCompleto: texto(datos.full_name),
      fechaNacimiento: texto(datos.birth_date),
      genero: texto(datos.gender),
      error: null,
      detener: false,
    };
  }

  // La API respondió, pero sin datos de esa cédula: no existe o es inválida.
  if (res.ok || [400, 404, 422].includes(res.status)) {
    return {
      ...base,
      estado: "no_encontrada",
      httpStatus: res.status,
      respuesta: cuerpo,
      error: mensajeDe(cuerpo, res.status),
      detener: false,
    };
  }

  // 5xx u otro código: falla del servicio, se reintenta otro día.
  return {
    ...base,
    estado: "error",
    httpStatus: res.status,
    respuesta: cuerpo,
    error: mensajeDe(cuerpo, res.status),
    detener: false,
  };
}
