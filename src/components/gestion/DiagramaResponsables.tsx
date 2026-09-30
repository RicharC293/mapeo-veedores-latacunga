import ArbolNodo from "./ArbolNodo";
import { title } from "../../lib/format";
import type { Lider } from "../../lib/gestion/types";
import type { ParroquiaFeature, Recinto } from "../../lib/types";

interface Props {
  lideres: Lider[];
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
}

export default function DiagramaResponsables({
  lideres,
  parroquias,
  recintos,
}: Props) {
  const grupos = parroquias
    .map((p) => {
      const filas = recintos
        .filter((r) => r.par === p.properties.code)
        .map((r) => ({
          recinto: r,
          responsables: lideres.filter((l) =>
            l.recintoCodigos.includes(r.cod),
          ),
        }));
      return { parroquia: p, filas };
    })
    .filter((g) => g.filas.some((f) => f.responsables.length > 0))
    .sort((a, b) =>
      a.parroquia.properties.name.localeCompare(b.parroquia.properties.name),
    );

  if (grupos.length === 0) {
    return (
      <p class="g-empty">
        Todavía no hay recintos con un responsable asignado.
      </p>
    );
  }

  return (
    <div class="g-tree">
      {grupos.map((g) => {
        const conResponsable = g.filas.filter(
          (f) => f.responsables.length > 0,
        ).length;
        return (
          <ArbolNodo
            key={g.parroquia.properties.code}
            titulo={g.parroquia.properties.name}
            subtitulo={`${conResponsable}/${g.filas.length} recintos`}
          >
            {g.filas.map((f) => (
              <div class="g-persona" key={f.recinto.cod}>
                <div>
                  <strong>{title(f.recinto.nombre)}</strong>
                  <small>
                    {f.responsables.length > 0
                      ? f.responsables.map((l) => l.nombres).join(", ")
                      : "Sin responsable"}
                  </small>
                </div>
              </div>
            ))}
          </ArbolNodo>
        );
      })}
    </div>
  );
}
