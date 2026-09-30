import { useState } from "preact/hooks";
import PersonaForm from "./PersonaForm";
import DesvincularForm from "./DesvincularForm";

export interface PersonaAsignada {
  id: string;
  cedula: string;
  nombres: string;
  telefono: string;
  responsable: string;
  verificado: boolean;
}

interface Props {
  titulo: string;
  titular: PersonaAsignada | null;
  suplentes: PersonaAsignada[];
  onAgregarTitular: (input: {
    cedula: string;
    nombres: string;
    telefono: string;
    responsable: string;
  }) => Promise<void>;
  onAgregarSuplente: (input: {
    cedula: string;
    nombres: string;
    telefono: string;
    responsable: string;
  }) => Promise<void>;
  onDesvincular: (
    id: string,
    motivo: string | null,
    listaNegra: boolean,
  ) => Promise<void>;
  onVerificar: (id: string, verificado: boolean) => Promise<void>;
}

type Abierto = null | "titular" | "suplente" | { desvincular: string };

export default function AsignacionCard({
  titulo,
  titular,
  suplentes,
  onAgregarTitular,
  onAgregarSuplente,
  onDesvincular,
  onVerificar,
}: Props) {
  const [abierto, setAbierto] = useState<Abierto>(null);

  return (
    <div class="g-card">
      <h4>{titulo}</h4>

      <div class="g-slot">
        <span class="g-slot-label">Titular</span>
        {titular ? (
          <PersonaRow
            persona={titular}
            onDesvincular={() => setAbierto({ desvincular: titular.id })}
            onVerificar={(v) => onVerificar(titular.id, v)}
          />
        ) : abierto === "titular" ? (
          <PersonaForm
            etiqueta="Agregar titular"
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
                persona={s}
                onDesvincular={() => setAbierto({ desvincular: s.id })}
                onVerificar={(v) => onVerificar(s.id, v)}
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
  persona,
  onDesvincular,
  onVerificar,
}: {
  persona: PersonaAsignada;
  onDesvincular: () => void;
  onVerificar: (verificado: boolean) => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);

  return (
    <div class="g-persona">
      <div>
        <strong>{persona.nombres}</strong>
        <small>
          CI {persona.cedula}
          {persona.telefono ? ` · ${persona.telefono}` : ""}
          {persona.responsable ? ` · ${persona.responsable}` : ""}
        </small>
        <label class="g-check g-check-verificado">
          <input
            type="checkbox"
            checked={persona.verificado}
            disabled={enviando}
            onChange={async (e) => {
              const checked = (e.currentTarget as HTMLInputElement).checked;
              setEnviando(true);
              try {
                await onVerificar(checked);
              } finally {
                setEnviando(false);
              }
            }}
          />
          Verificado
        </label>
      </div>
      <button class="g-btn-danger-ghost" onClick={onDesvincular}>
        Desvincular
      </button>
    </div>
  );
}
