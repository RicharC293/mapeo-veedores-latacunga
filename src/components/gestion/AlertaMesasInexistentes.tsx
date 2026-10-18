import { useState } from "preact/hooks";
import { title } from "../../lib/format";
import type { Recinto } from "../../lib/types";

interface VeedorHuerfano {
  id: string;
  nombres: string;
  cedula: string;
  juntaId: string;
  recintoCodigo: number;
}

interface Props {
  veedores: VeedorHuerfano[];
  recintos: Recinto[];
  // Los devuelve a Militancia (sin lista negra) para volver a asignarlos.
  onDevolver: (id: string) => Promise<void>;
}

// Aviso de veedores guardados en una mesa que su recinto no tiene. No salen en
// ninguna lista de juntas, así que esta es la única forma de verlos.
export default function AlertaMesasInexistentes({
  veedores,
  recintos,
  onDevolver,
}: Props) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (veedores.length === 0) return null;

  const devolver = async (id: string) => {
    setEnviando(id);
    setError(null);
    try {
      await onDevolver(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviando(null);
    }
  };

  return (
    <section class="g-alerta-mesas" role="alert">
      <h3>
        {veedores.length === 1
          ? "1 veedor está en una mesa que su recinto no tiene"
          : `${veedores.length} veedores están en una mesa que su recinto no tiene`}
      </h3>
      <p>
        No aparecen en ninguna junta ni cuentan para la cobertura. Devuélvelos a
        Militancia y asígnalos de nuevo a una mesa del recinto.
      </p>
      <ul>
        {veedores.map((v) => {
          const recinto = recintos.find((r) => r.cod === v.recintoCodigo);
          return (
            <li key={v.id}>
              <span class="g-alerta-mesas-texto">
                <strong>{v.nombres}</strong>
                <small>
                  CI {v.cedula} · mesa {v.juntaId.split("-")[1]} en{" "}
                  {recinto
                    ? title(recinto.nombre)
                    : `recinto ${v.recintoCodigo}`}
                </small>
              </span>
              <button
                type="button"
                class="g-btn-ghost"
                disabled={enviando !== null}
                onClick={() => devolver(v.id)}
              >
                {enviando === v.id ? "Devolviendo…" : "Devolver a Militancia"}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p class="g-error">{error}</p> : null}
    </section>
  );
}
