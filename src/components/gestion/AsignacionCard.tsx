import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import PersonaForm from "./PersonaForm";
import BotonIcono from "./BotonIcono";
import DesvincularForm from "./DesvincularForm";
import Iniciales from "./Iniciales";
import Resaltado from "./Resaltado";
import type { Lider } from "../../lib/gestion/types";

export interface PersonaAsignada {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  email: string;
  // Recinto de preferencia con el que llegó desde Militancia.
  preferencia?: string;
  responsableLiderId: string | null;
  verificado: boolean;
}

interface Props {
  // El título puede traer su propio resaltado (el nombre del recinto).
  titulo: ComponentChildren;
  // Búsqueda activa: se pinta lo que coincide con el nombre y la cédula.
  busqueda?: string;
  titular: PersonaAsignada | null;
  suplentes: PersonaAsignada[];
  lideres: Lider[];
  onAgregarTitular: (input: {
    cedula: string;
    nombres: string;
    telefono: string;
    email: string;
    responsableLiderId: string | null;
  }) => Promise<void>;
  onAgregarSuplente: (input: {
    cedula: string;
    nombres: string;
    telefono: string;
    email: string;
    responsableLiderId: string | null;
  }) => Promise<void>;
  onDesvincular: (
    id: string,
    motivo: string | null,
    listaNegra: boolean,
  ) => Promise<void>;
}

type Abierto = null | "titular" | "suplente" | { desvincular: string };

export default function AsignacionCard({
  titulo,
  busqueda = "",
  titular,
  suplentes,
  lideres,
  onAgregarTitular,
  onAgregarSuplente,
  onDesvincular,
}: Props) {
  const [abierto, setAbierto] = useState<Abierto>(null);

  return (
    <div class="g-card">
      <h4>{titulo}</h4>

      <div class="g-slot g-slot-titular">
        <span class="g-slot-label">Titular</span>
        {titular ? (
          <PersonaRow
            rol="titular"
            busqueda={busqueda}
            persona={titular}
            lideres={lideres}
            onDesvincular={() => setAbierto({ desvincular: titular.id })}
          />
        ) : abierto === "titular" ? (
          <PersonaForm
            etiqueta="Agregar titular"
            lideres={lideres}
            onSubmit={async (input) => {
              await onAgregarTitular(input);
              setAbierto(null);
            }}
            onCancel={() => setAbierto(null)}
          />
        ) : (
          <button class="g-btn-add" onClick={() => setAbierto("titular")}>
            + Agregar titular
          </button>
        )}
        {abierto !== null &&
        typeof abierto === "object" &&
        abierto.desvincular === titular?.id ? (
          <DesvincularForm
            onConfirm={async (motivo, listaNegra) => {
              await onDesvincular(titular!.id, motivo, listaNegra);
              setAbierto(null);
            }}
            onCancel={() => setAbierto(null)}
          />
        ) : null}
      </div>

      <div class="g-slot">
        <span class="g-slot-label">Suplentes ({suplentes.length})</span>
        <ul class="g-suplentes">
          {suplentes.map((s) => (
            <li key={s.id}>
              <PersonaRow
                rol="suplente"
                busqueda={busqueda}
                persona={s}
                lideres={lideres}
                onDesvincular={() => setAbierto({ desvincular: s.id })}
              />
              {abierto !== null &&
              typeof abierto === "object" &&
              abierto.desvincular === s.id ? (
                <DesvincularForm
                  onConfirm={async (motivo, listaNegra) => {
                    await onDesvincular(s.id, motivo, listaNegra);
                    setAbierto(null);
                  }}
                  onCancel={() => setAbierto(null)}
                />
              ) : null}
            </li>
          ))}
        </ul>
        {abierto === "suplente" ? (
          <PersonaForm
            etiqueta="Agregar suplente"
            lideres={lideres}
            onSubmit={async (input) => {
              await onAgregarSuplente(input);
              setAbierto(null);
            }}
            onCancel={() => setAbierto(null)}
          />
        ) : (
          <button class="g-btn-add" onClick={() => setAbierto("suplente")}>
            + Agregar suplente
          </button>
        )}
      </div>
    </div>
  );
}

function PersonaRow({
  rol,
  busqueda,
  persona,
  lideres,
  onDesvincular,
}: {
  rol: "titular" | "suplente";
  busqueda: string;
  persona: PersonaAsignada;
  lideres: Lider[];
  onDesvincular: () => void;
}) {
  const responsable = lideres.find((l) => l.id === persona.responsableLiderId);

  return (
    <div class="g-persona g-persona-asig">
      <Iniciales nombres={persona.nombres} rol={rol} />
      <div class="g-persona-texto">
        <strong>
          <Resaltado texto={persona.nombres} consulta={busqueda} />
        </strong>
        <small>
          CI <Resaltado texto={persona.cedula} consulta={busqueda} />
          {persona.telefono ? ` · ${persona.telefono}` : ""}
          {persona.email ? ` · ${persona.email}` : ""}
          {responsable ? ` · ${responsable.nombres}` : ""}
        </small>
        {persona.preferencia ? (
          <small class="g-persona-pref">
            Preferencia: {persona.preferencia}
          </small>
        ) : null}
        {/* Solo se lee: se verifica desde Contacto, al confirmar por WhatsApp. */}
        {persona.verificado ? (
          <span class="chip-estado chip-estado-ok">Verificado</span>
        ) : null}
      </div>
      <BotonIcono
        icono="basura"
        peligro
        etiqueta={`Desvincular a ${persona.nombres}`}
        onClick={onDesvincular}
      />
    </div>
  );
}
