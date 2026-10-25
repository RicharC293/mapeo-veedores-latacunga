import { useRef, useState } from "preact/hooks";

interface Props {
  // Cédulas del Consolidado que faltan consultar (válidas y sin consulta
  // previa, o con un error técnico).
  pendientes: string[];
  // Cédulas cuyo nombre solo difiere del oficial en el formato.
  coinciden: string[];
  costoPorConsulta: number;
  hayClave: boolean;
  // Se llama al terminar, con un resumen para mostrar.
  onTerminar: (mensaje: string) => Promise<void>;
  onAplicarCoinciden: () => Promise<void>;
}

interface Lote {
  consultadas: number;
  validadas: number;
  noEncontradas: number;
  conError: number;
  detenido: string | null;
}

const POR_TANDA = 10;

const dolares = (n: number) =>
  `US$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Barra del administrador en el Consolidado: consulta en el Registro Civil a
// todas las personas que aún no se verificaron (al principio casi todas;
// después, solo las nuevas) y aplica en bloque los nombres que coinciden.
export default function SincronizarIdentidad({
  pendientes,
  coinciden,
  costoPorConsulta,
  hayClave,
  onTerminar,
  onAplicarCoinciden,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [progreso, setProgreso] = useState<{
    hechas: number;
    total: number;
  } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detenerRef = useRef(false);
  const costo = pendientes.length * costoPorConsulta;

  const sincronizar = async () => {
    setConfirmando(false);
    setError(null);
    detenerRef.current = false;
    const lista = [...pendientes];
    const total: Lote = {
      consultadas: 0,
      validadas: 0,
      noEncontradas: 0,
      conError: 0,
      detenido: null,
    };
    setProgreso({ hechas: 0, total: lista.length });
    try {
      for (let i = 0; i < lista.length && !detenerRef.current; i += POR_TANDA) {
        const tanda = lista.slice(i, i + POR_TANDA);
        const res = await fetch("/api/gestion/validacion/consultar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cedulas: tanda }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error ?? "Error inesperado.");
        const lote = r as Lote;
        total.consultadas += lote.consultadas;
        total.validadas += lote.validadas;
        total.noEncontradas += lote.noEncontradas;
        total.conError += lote.conError;
        setProgreso({
          hechas: Math.min(i + tanda.length, lista.length),
          total: lista.length,
        });
        if (lote.detenido) {
          total.detenido = lote.detenido;
          break;
        }
      }
      const inicio = total.detenido
        ? `Se detuvo: ${total.detenido} `
        : detenerRef.current
          ? "Sincronización detenida. "
          : "Sincronización terminada. ";
      await onTerminar(
        `${inicio}Consultadas ${total.consultadas}: ${total.validadas} con datos, ${total.noEncontradas} no encontradas, ${total.conError} con error.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setProgreso(null);
    }
  };

  const aplicar = async () => {
    setAplicando(true);
    setError(null);
    try {
      await onAplicarCoinciden();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <section class="g-sinc" aria-label="Verificación de identidad">
      {!hayClave ? (
        <p class="g-sinc-texto">
          La verificación de identidad necesita la clave ECUADORAPI_KEY en el
          servidor.
        </p>
      ) : progreso ? (
        <>
          <p class="g-sinc-texto" role="status">
            Verificando identidades: {progreso.hechas} de {progreso.total}…
          </p>
          <button
            type="button"
            class="g-btn-ghost"
            onClick={() => (detenerRef.current = true)}
          >
            Detener
          </button>
        </>
      ) : confirmando ? (
        <div
          class="g-sinc-confirmar"
          role="alertdialog"
          aria-label="Confirmar sincronización"
        >
          <span>
            Se consultarán <strong>{pendientes.length}</strong>{" "}
            {pendientes.length === 1 ? "persona" : "personas"} en el Registro
            Civil: hasta <strong>{dolares(costo)}</strong>.
          </span>
          <button type="button" class="g-btn-accion" onClick={sincronizar}>
            Sí, sincronizar
          </button>
          <button
            type="button"
            class="g-btn-ghost"
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <p class="g-sinc-texto">
            {pendientes.length === 0
              ? "Todas las personas del Consolidado ya tienen su identidad consultada."
              : `${pendientes.length} ${pendientes.length === 1 ? "persona sin" : "personas sin"} verificar en el Registro Civil · ≈ ${dolares(costo)}`}
          </p>
          <button
            type="button"
            class="g-btn-accion"
            disabled={pendientes.length === 0}
            onClick={() => setConfirmando(true)}
          >
            Sincronizar
          </button>
          {coinciden.length > 0 ? (
            <button
              type="button"
              class="g-btn-ghost"
              disabled={aplicando}
              onClick={aplicar}
            >
              Aplicar nombre oficial a{" "}
              {coinciden.length === 1
                ? "la que coincide"
                : `las ${coinciden.length} que coinciden`}
            </button>
          ) : null}
        </>
      )}
      {error ? <p class="g-error">{error}</p> : null}
    </section>
  );
}
