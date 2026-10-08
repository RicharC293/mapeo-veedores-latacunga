interface Props {
  icono: "mover" | "basura";
  // Nombre de la acción: lo leen los lectores de pantalla y aparece como
  // sugerencia al pasar el cursor, porque el botón no lleva texto.
  etiqueta: string;
  peligro?: boolean;
  disabled?: boolean;
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
};

export default function BotonIcono({
  icono,
  etiqueta,
  peligro,
  disabled,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      class={`g-btn-icono${peligro ? " g-btn-icono-peligro" : ""}`}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
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
