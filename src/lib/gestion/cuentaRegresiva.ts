// Inicio de la votación: 29 de noviembre de 2026, 6:00 a. m. en Ecuador
// (UTC-5, sin horario de verano), es decir 11:00 UTC.
export const ELECCIONES_INICIO = Date.UTC(2026, 10, 29, 11, 0, 0);

export interface CuentaRegresiva {
  // true cuando la fecha ya pasó: no se muestran cifras negativas.
  iniciada: boolean;
  dias: number;
  horas: number;
  minutos: number;
  // Cuántas personas hay que conseguir por día para llegar con todos los
  // puestos cubiertos (0 si no falta nadie o ya empezó).
  ritmoPorDia: number;
  // true si queda menos de un día: el ritmo es "hoy" y no "por día".
  esHoy: boolean;
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export function calcularCuentaRegresiva(
  ahora: number,
  inicio: number,
  faltan: number,
): CuentaRegresiva {
  const restante = inicio - ahora;
  if (restante <= 0) {
    return {
      iniciada: true,
      dias: 0,
      horas: 0,
      minutos: 0,
      ritmoPorDia: 0,
      esHoy: false,
    };
  }
  const dias = Math.floor(restante / DIA);
  const horas = Math.floor((restante % DIA) / HORA);
  const minutos = Math.floor((restante % HORA) / MINUTO);
  const diasDecimales = restante / DIA;
  const esHoy = diasDecimales < 1;
  return {
    iniciada: false,
    dias,
    horas,
    minutos,
    ritmoPorDia:
      faltan > 0 ? Math.ceil(faltan / Math.max(diasDecimales, 1)) : 0,
    esHoy,
  };
}
