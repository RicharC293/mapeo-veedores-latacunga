import type { ComponentChildren } from "preact";
import type { ParroquiaBasica } from "../../lib/types";

interface Props {
  parroquia: ParroquiaBasica | undefined;
  // Texto de avance a la derecha del encabezado ("3 de 5 con coordinador").
  cuenta: string;
  children: ComponentChildren;
}

// Bloque plegable de una parroquia: nombre, si es urbana o rural y su avance.
export default function GrupoParroquia({ parroquia, cuenta, children }: Props) {
  return (
    <details class="g-grupo" open>
      <summary>
        <span class="g-grupo-nombre">
          {parroquia?.properties.name ?? "Sin parroquia"}
        </span>
        {parroquia ? (
          <span class="chip-estado chip-estado-sin">
            {parroquia.properties.urbana ? "Urbana" : "Rural"}
          </span>
        ) : null}
        <span class="g-grupo-cuenta">{cuenta}</span>
      </summary>
      {children}
    </details>
  );
}
