import ArbolNodo from "./ArbolNodo";
import { title } from "../../lib/format";
import { CUPO_CARGO } from "../../lib/gestion/types";
import type { Cargo, Lider } from "../../lib/gestion/types";
import type { ParroquiaFeature, Recinto } from "../../lib/types";

interface Props {
  lideres: Lider[];
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
}

const CARGOS: Cargo[] = [
  "alcalde",
  "concejal_urbano",
  "concejal_rural",
  "vocal_junta_parroquial",
];

// Etiquetas de grupo (plural) para los encabezados del árbol; distintas de
// CARGO_LABEL (singular, en types.ts) que se usa en el <select> del
// formulario y en la lista de líderes.
const GRUPO_LABEL: Record<Cargo, string> = {
  alcalde: "Alcalde",
  concejal_urbano: "Concejales urbanos",
  concejal_rural: "Concejales rurales",
  vocal_junta_parroquial: "Vocales de junta parroquial",
};

function nombreParroquia(parroquias: ParroquiaFeature[], cod: number | null) {
  if (cod == null) return "";
  return (
    parroquias.find((p) => p.properties.code === cod)?.properties.name ?? ""
  );
}

function DignidadCard({
  lider,
  parroquias,
  recintos,
}: {
  lider: Lider;
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
}) {
  const iniciales = lider.nombres
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div class="g-dignidad-card">
      {lider.foto ? (
        <img class="g-avatar" src={lider.foto} alt={lider.nombres} />
      ) : (
        <div class="g-avatar-placeholder">{iniciales || "?"}</div>
      )}
      <div class="g-card">
        <h4>{lider.nombres}</h4>
        {lider.cargo === "vocal_junta_parroquial" ? (
          <small>{nombreParroquia(parroquias, lider.parroquiaCodigo)}</small>
        ) : null}
        {lider.organizacion ? <small>{lider.organizacion}</small> : null}
        {lider.ambito === "candidato" ? (
          <small>
            {lider.parroquiaCodigos.length > 0
              ? `Parroquias a cargo: ${lider.parroquiaCodigos
                  .map((cod) => nombreParroquia(parroquias, cod))
                  .join(", ")}`
              : "Sin parroquias asignadas"}
          </small>
        ) : (
          <small>
            {lider.recintoCodigos.length > 0
              ? `Recintos: ${lider.recintoCodigos
                  .map((cod) =>
                    title(recintos.find((r) => r.cod === cod)?.nombre ?? ""),
                  )
                  .join(", ")}`
              : "Sin recintos asignados"}
          </small>
        )}
      </div>
    </div>
  );
}

export default function DiagramaEstructura({
  lideres,
  parroquias,
  recintos,
}: Props) {
  const candidatos = lideres
    .filter((l) => l.ambito === "candidato")
    .sort((a, b) => a.nombres.localeCompare(b.nombres));

  return (
    <div>
      <div class="g-alianza">
        <div class="g-org-node">
          <b>Alianza Campo Ciudad</b>
        </div>
        <div class="g-org-children">
          <div class="g-org-node">
            <b>Pachakutik</b>
          </div>
          <div class="g-org-node">
            <b>Incluyente</b>
          </div>
        </div>
      </div>

      <div class="g-tree">
        {CARGOS.map((cargo) => {
          const items = lideres.filter((l) => l.cargo === cargo);
          const subtitulo =
            cargo === "vocal_junta_parroquial"
              ? `${items.length} de 10 parroquias`
              : `${items.length}/${CUPO_CARGO[cargo]}`;
          return (
            <ArbolNodo
              key={cargo}
              titulo={GRUPO_LABEL[cargo]}
              subtitulo={subtitulo}
              defaultAbierto
            >
              {items.length === 0 ? (
                <p class="g-empty">Sin asignar.</p>
              ) : (
                items.map((l) => (
                  <DignidadCard
                    key={l.id}
                    lider={l}
                    parroquias={parroquias}
                    recintos={recintos}
                  />
                ))
              )}
            </ArbolNodo>
          );
        })}
        <ArbolNodo
          titulo="Candidatos"
          subtitulo={`${candidatos.length}`}
          defaultAbierto
        >
          {candidatos.length === 0 ? (
            <p class="g-empty">Sin candidatos registrados.</p>
          ) : (
            candidatos.map((l) => (
              <DignidadCard
                key={l.id}
                lider={l}
                parroquias={parroquias}
                recintos={recintos}
              />
            ))
          )}
        </ArbolNodo>
      </div>
    </div>
  );
}
