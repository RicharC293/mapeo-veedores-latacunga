import { useEffect, useRef } from "preact/hooks";

export type AvisoAsignacion =
  | {
      tipo: "confirmar";
      titular: string;
      // Junta elegida automáticamente donde quedaría como suplente.
      automatico?: boolean;
      junta?: string;
    }
  | {
      tipo: "lleno";
      titular: string;
      suplente: string;
      automatico?: boolean;
    };

interface Props {
  aviso: AvisoAsignacion;
  // Descripción del lugar, con mayúscula inicial: "La junta F1 de …" o, con
  // la junta automática, "Todas las juntas femeninas de …".
  lugar: string;
  persona: string;
  // Sección donde sí se pueden agregar más suplentes a mano.
  seccion: string;
  enviando: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}

// Aviso al asignar a un lugar ya ocupado. Usa <dialog> nativo: el foco queda
// atrapado dentro, Escape cierra y el fondo se bloquea sin código extra.
export default function DialogoAsignacion({
  aviso,
  lugar,
  persona,
  seccion,
  enviando,
  onConfirmar,
  onCerrar,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  const confirmar = aviso.tipo === "confirmar";

  return (
    <dialog
      ref={ref}
      class="g-dialogo"
      aria-labelledby="g-dialogo-titulo"
      aria-describedby="g-dialogo-desc"
      onClose={onCerrar}
    >
      <h3 id="g-dialogo-titulo">
        {confirmar ? "Se asignará como suplente" : "No se puede asignar"}
      </h3>
      <div id="g-dialogo-desc">
        {confirmar ? (
          aviso.automatico ? (
            <p>
              {lugar} ya tienen veedor titular. <strong>{persona}</strong>{" "}
              quedará como suplente de la junta <strong>{aviso.junta}</strong>,
              cuyo titular es <strong>{aviso.titular}</strong>.
            </p>
          ) : (
            <p>
              {lugar} ya tiene como titular a <strong>{aviso.titular}</strong>.{" "}
              <strong>{persona}</strong> quedará como suplente.
            </p>
          )
        ) : aviso.automatico ? (
          <>
            <p>
              {lugar} ya tienen titular y suplente. No quedan cupos disponibles.
            </p>
            <p class="g-sub">
              Desde Militancia solo se asigna un suplente por junta. Para
              agregar más, hazlo desde {seccion}.
            </p>
          </>
        ) : (
          <>
            <p>
              {lugar} ya tiene titular (<strong>{aviso.titular}</strong>) y
              suplente (<strong>{aviso.suplente}</strong>). No quedan cupos
              disponibles.
            </p>
            <p class="g-sub">
              Desde Militancia solo se asigna un suplente. Para agregar más,
              hazlo desde {seccion}.
            </p>
          </>
        )}
      </div>
      <div class="g-form-actions">
        {confirmar ? (
          <>
            <button
              type="button"
              class="g-btn-accion"
              disabled={enviando}
              onClick={onConfirmar}
            >
              {enviando ? "Asignando…" : "Sí, asignar"}
            </button>
            <button
              type="button"
              class="g-btn-ghost"
              disabled={enviando}
              onClick={() => ref.current?.close()}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            class="g-btn-accion"
            onClick={() => ref.current?.close()}
          >
            Entendido
          </button>
        )}
      </div>
    </dialog>
  );
}
