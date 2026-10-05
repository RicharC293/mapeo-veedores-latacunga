import { emailValido, normalizarEmail } from "./email";

// Validación de los datos básicos de una fila de Militancia. Es pura (sin
// acceso a base de datos ni a node) para poder usarla igual en el servidor
// y en el navegador. Los datos incorrectos no se rechazan: la fila se carga
// tal cual y se marca "Incorrecto" con el campo en rojo, para corregirla
// después.
export interface DatosMilitante {
  cedula: string;
  nombres: string;
  telefono: string;
  email: string;
}

// true = el campo tiene un error.
export interface ErroresMilitante {
  cedula: boolean;
  nombres: boolean;
  telefono: boolean;
  email: boolean;
}

export const MENSAJE_ERROR: Record<keyof ErroresMilitante, string> = {
  cedula:
    "Cédula inválida: debe tener 10 dígitos y un dígito verificador correcto.",
  nombres: "Falta el nombre.",
  telefono: "El teléfono debe tener 10 dígitos.",
  email: "El correo no tiene un formato válido.",
};

// 10 dígitos, provincia 01-24 (o 30 para ecuatorianos en el exterior), tercer
// dígito menor a 6 y dígito verificador por módulo 10.
export function cedulaEcuatorianaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(cedula[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    const d = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    suma += d > 9 ? d - 9 : d;
  }
  return (10 - (suma % 10)) % 10 === Number(cedula[9]);
}

export function erroresMilitante(datos: DatosMilitante): ErroresMilitante {
  const email = normalizarEmail(datos.email);
  return {
    cedula: !cedulaEcuatorianaValida(datos.cedula.trim()),
    nombres: datos.nombres.trim() === "",
    telefono: !/^\d{10}$/.test(datos.telefono.trim()),
    // El correo es opcional: vacío es válido; si viene, debe tener formato.
    email: email !== "" && !emailValido(email),
  };
}

export function esIncorrecto(errores: ErroresMilitante): boolean {
  return errores.cedula || errores.nombres || errores.telefono || errores.email;
}
