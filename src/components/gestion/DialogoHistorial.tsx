import { useEffect, useRef, useState } from "preact/hooks";
import type { EdicionMilitante } from "../../lib/gestion/types";

interface Props {
  militanteId: string;
  persona: string;
  onCerrar: () => void;
}

// Fecha y hora siempre en hora de Ecuador, igual en servidor y navegador.
const formatoFecha = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : formatoFecha.format(d);
}

// Historial de ediciones de una persona de Militancia: qué cambió, quién lo
// hizo y cuándo. Se carga al abrir, para no pedir los datos de todas las
// tarjetas.
export default function DialogoHistorial({
  militanteId,
  persona,
  onCerrar,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [ediciones, setEdiciones] = useState<EdicionMilitante[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
    let vigente = true;
    fetch(`/api/gestion/militancia/${militanteId}/historial`)
      .then(async (res) => {
        const cuerpo = await res.json();
        if (!res.ok) throw new Error(cuerpo.error ?? "Error inesperado.");
        if (vigente) setEdiciones(cuerpo as EdicionMilitante[]);
      })
      .catch((err) => {
        if (vigente)
          setError(err instanceof Error ? err.message : "Error inesperado.");
      });
    return () => {
      vigente = false;
    };
  }, [militanteId]);

  const vacio = (valor: string) => (valor === "" ? "(vacío)" : valor);

  return (
    <dialog
      ref={ref}
      class="g-dialogo g-dialogo-historial"
      aria-labelledby="g-historial-titulo"
      onClose={onCerrar}
    >
      <h3 id="g-historial-titulo">Historial de {persona}</h3>
      {error ? (
        <p class="g-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && ediciones === null ? (
        <p class="g-sub" role="status">
          Cargando…
        </p>
      ) : null}
      {ediciones && ediciones.length === 0 ? (
        <p class="g-sub">Esta persona no tiene ediciones registradas.</p>
      ) : null}
      {ediciones && ediciones.length > 0 ? (
        <ol class="g-historial">
          {ediciones.map((e) => (
            <li key={e.id}>
              <p class="g-historial-quien">
                <strong>{e.usuario || "Usuario desconocido"}</strong>
                <span>{fecha(e.creadoEn)}</span>
              </p>
              <ul class="g-historial-cambios">
                {e.cambios.map((c) => (
                  <li key={c.campo}>
                    <span class="g-historial-campo">{c.campo}</span>
                    <span class="g-historial-antes">{vacio(c.antes)}</span>
                    <span aria-hidden="true">→</span>
                    <span class="g-historial-despues">{vacio(c.despues)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
      <div class="g-form-actions">
        <button
          type="button"
          class="g-btn-accion"
          onClick={() => ref.current?.close()}
        >
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
