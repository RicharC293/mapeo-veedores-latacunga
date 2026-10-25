interface Props {
  icono: "mover" | "basura" | "check" | "candado" | "deshacer" | "documento";
  // Nombre de la acción: lo leen los lectores de pantalla y aparece como
  // sugerencia al pasar el cursor, porque el botón no lleva texto.
  etiqueta: string;
  peligro?: boolean;
  disabled?: boolean;
  // Botón que abre o cierra algo (la respuesta del Registro Civil).
  presionado?: boolean;
  onClick: () => void;
}

// Trazos de 24×24 con un mismo grosor y extremos redondeados.
const TRAZOS: Record<Props["icono"], string[]> = {
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
};

export default function BotonIcono({
  icono,
  etiqueta,
  peligro,
  disabled,
  presionado,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      class={`g-btn-icono${peligro ? " g-btn-icono-peligro" : ""}`}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      aria-pressed={presionado}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {TRAZOS[icono].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </button>
  );
}
