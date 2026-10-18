import type { ComponentChildren } from "preact";
import type { ParroquiaBasica } from "../../lib/types";
import Resaltado from "./Resaltado";

interface Props {
  parroquia: ParroquiaBasica | undefined;
  // Texto de avance a la derecha del encabezado ("3 de 5 con coordinador").
  cuenta: string;
  // Búsqueda activa: lo que coincide con el nombre se pinta aparte.
  busqueda?: string;
  children: ComponentChildren;
}

// Bloque plegable de una parroquia: nombre, si es urbana o rural y su avance.
export default function GrupoParroquia({
  parroquia,
  cuenta,
  busqueda = "",
  children,
}: Props) {
  return (
    <details class="g-grupo" open>
      <summary>
        <span class="g-grupo-nombre">
          {parroquia ? (
            <Resaltado texto={parroquia.properties.name} consulta={busqueda} />
          ) : (
            "Sin parroquia"
          )}
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
