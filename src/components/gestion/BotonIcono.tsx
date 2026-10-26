export type Icono =
  | "mover"
  | "basura"
  | "check"
  | "candado"
  | "deshacer"
  | "documento"
  | "whatsapp"
  | "copiar"
  | "celularMal"
  | "noParticipa"
  | "cedula";

interface Props {
  icono: Icono;
  // Nombre de la acción: lo leen los lectores de pantalla y aparece como
  // sugerencia al pasar el cursor, porque el botón no lleva texto.
  etiqueta: string;
  peligro?: boolean;
  // Acción positiva (confirmar): en verde.
  exito?: boolean;
  disabled?: boolean;
  // Botón que abre o cierra algo (la respuesta del Registro Civil).
  presionado?: boolean;
  onClick: () => void;
}

// Trazos de 24×24 con un mismo grosor y extremos redondeados.
const TRAZOS: Record<Icono, string[]> = {
  // Flechas en las cuatro direcciones.
  mover: [
    "M5 9l-3 3 3 3",
    "M9 5l3-3 3 3",
    "M15 19l-3 3-3-3",
    "M19 9l3 3-3 3",
    "M2 12h20",
    "M12 2v20",
  ],
  // Papelera con tapa y dos rayas.
  basura: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  // Visto: usar el nombre oficial.
  check: ["M4 12.5l5 5L20 6.5"],
  // Candado cerrado: mantener el nombre actual.
  candado: [
    "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
    "M8 11V7a4 4 0 0 1 8 0v4",
  ],
  // Flecha que vuelve: deshacer.
  deshacer: ["M9 14L4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-3"],
  // Hoja con renglones: ver la respuesta del Registro Civil.
  documento: [
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z",
    "M14 3v5h5",
    "M9 13h6",
    "M9 17h6",
  ],
  // Globo de conversación: escribir por WhatsApp.
  whatsapp: [
    "M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z",
    "M8.5 11.5h.01",
    "M12 11.5h.01",
    "M15.5 11.5h.01",
  ],
  // Dos hojas superpuestas: copiar.
  copiar: [
    "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z",
    "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  ],
  // Celular tachado: número equivocado.
  celularMal: [
    "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
    "M11 18h2",
    "M10 8l4 4",
    "M14 8l-4 4",
  ],
  // Persona con una equis: no participa.
  noParticipa: [
    "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M3 21a7 7 0 0 1 11.5-5.4",
    "M17 15l4 4",
    "M21 15l-4 4",
  ],
  // Credencial con foto: cédula recibida.
  cedula: [
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M5.5 16a3 3 0 0 1 6 0",
    "M14 10h4",
    "M14 14h3",
  ],
};

// Solo el dibujo, para usarlo dentro de un enlace (el de WhatsApp).
export function TrazosIcono({ icono }: { icono: Icono }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRAZOS[icono].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default function BotonIcono({
  icono,
  etiqueta,
  peligro,
  exito,
  disabled,
  presionado,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      class={`g-btn-icono${peligro ? " g-btn-icono-peligro" : ""}${exito ? " g-btn-icono-exito" : ""}`}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      aria-pressed={presionado}
      onClick={onClick}
    >
      <TrazosIcono icono={icono} />
    </button>
  );
}
