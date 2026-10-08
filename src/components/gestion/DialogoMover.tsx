import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { title } from "../../lib/format";
import {
  ETIQUETA_CLASE,
  PUESTO_CLASE,
  estadoDeJuntas,
  etiquetaJunta,
  planificarMovimiento,
  recintosCercanosSinCubrir,
  type Clase,
  type DestinoSolicitado,
  type EstadoPuestos,
} from "../../lib/gestion/movimiento";
import type { ParroquiaBasica, Recinto } from "../../lib/types";

export interface PersonaAMover {
  id: string;
  cedula: string;
  nombres: string;
  clase: Clase;
  tipo: "titular" | "suplente";
  recintoCodigo: number;
  juntaId: string | null;
}

interface Props {
  persona: PersonaAMover;
  recintos: Recinto[];
  parroquias: ParroquiaBasica[];
  estado: EstadoPuestos;
  onMover: (destino: DestinoSolicitado) => Promise<void>;
  onCerrar: () => void;
}

const CLASES: Clase[] = ["veedor", "coordinador", "cda"];
const AUTO = "auto";

const km = (n: number) =>
  n < 10 ? n.toFixed(1).replace(".", ",") : String(Math.round(n));

// Mover a una persona entre junta, recinto y responsabilidad. Arranca en
// donde está hoy; el veedor no elige género ni número de junta: por defecto
// cubre la primera disponible del recinto elegido. Usa <dialog> nativo: el
// foco queda dentro, Escape cierra y el fondo se bloquea.
export default function DialogoMover({
  persona,
  recintos,
  parroquias,
  estado,
  onMover,
  onCerrar,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [clase, setClase] = useState<Clase>(persona.clase);
  const [recintoCod, setRecintoCod] = useState<number | "">(
    persona.recintoCodigo,
  );
  const [junta, setJunta] = useState<string>(persona.juntaId ?? AUTO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  const recinto = recintos.find((r) => r.cod === recintoCod) ?? null;
  const recintoActual = recintos.find((r) => r.cod === persona.recintoCodigo);
  const nombreParroquia = useMemo(
    () =>
      new Map(parroquias.map((p) => [p.properties.code, p.properties.name])),
    [parroquias],
  );

  // Dónde está hoy la persona, para precargar su junta si sigue en su recinto.
  const juntaPorDefecto = (c: Clase, cod: number | "") =>
    c === "veedor" &&
    persona.clase === "veedor" &&
    cod === persona.recintoCodigo
      ? (persona.juntaId ?? AUTO)
      : AUTO;

  const cambiarClase = (c: Clase) => {
    setClase(c);
    setError(null);
    const noEsCda = c === "cda" && recinto && !recinto.cda;
    if (noEsCda) setRecintoCod("");
    setJunta(juntaPorDefecto(c, noEsCda ? "" : recintoCod));
  };
  const cambiarRecinto = (cod: number | "") => {
    setRecintoCod(cod);
    setError(null);
    setJunta(juntaPorDefecto(clase, cod));
  };

  // Recintos del selector, agrupados por parroquia (solo CDA si es CDA).
  const grupos = useMemo(() => {
    const porParroquia = new Map<number, Recinto[]>();
    for (const r of recintos) {
      if (clase === "cda" && !r.cda) continue;
      porParroquia.set(r.par, [...(porParroquia.get(r.par) ?? []), r]);
    }
    return [...porParroquia.entries()]
      .map(([cod, items]) => ({
        nombre: nombreParroquia.get(cod) ?? "Sin parroquia",
        items: items.sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [recintos, clase, nombreParroquia]);

  // Juntas del recinto elegido y cómo están sin contar a la propia persona.
  const juntas = useMemo(
    () =>
      recinto
        ? estadoDeJuntas(
            recinto,
            estado.veedores.filter((v) => v.id !== persona.id),
          )
        : [],
    [recinto, estado.veedores, persona.id],
  );

  const plan = useMemo(
    () =>
      planificarMovimiento(
        {
          id: persona.id,
          cedula: persona.cedula,
          clase: persona.clase,
          recintoCodigo: persona.recintoCodigo,
          juntaId: persona.juntaId,
        },
        {
          clase,
          recintoCodigo: recintoCod === "" ? -1 : recintoCod,
          juntaId: clase === "veedor" && junta !== AUTO ? junta : null,
        },
        estado,
        recintos,
      ),
    [persona, clase, recintoCod, junta, estado, recintos],
  );

  const cercanos = useMemo(() => {
    const referencia = recinto ?? recintoActual;
    return referencia
      ? recintosCercanosSinCubrir(referencia, recintos, estado.veedores)
      : [];
  }, [recinto, recintoActual, recintos, estado.veedores]);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!plan.ok || enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await onMover({
        clase,
        recintoCodigo: plan.recintoCodigo,
        juntaId: clase === "veedor" && junta !== AUTO ? junta : null,
      });
      ref.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setEnviando(false);
    }
  };

  const donde = (
    clase_: Clase,
    tipo: "titular" | "suplente",
    juntaId: string | null,
    r: Recinto | undefined,
  ) =>
    `${ETIQUETA_CLASE[clase_]} ${tipo}${juntaId ? ` · Junta ${etiquetaJunta(juntaId)}` : ""}${r ? ` · ${title(r.nombre)}` : ""}`;

  return (
    <dialog
      ref={ref}
      class="g-dialogo g-dialogo-mover"
      aria-labelledby="g-mover-titulo"
      onClose={onCerrar}
    >
      <h3 id="g-mover-titulo">Mover a {persona.nombres}</h3>
      <p class="g-sub">
        Ahora:{" "}
        {donde(persona.clase, persona.tipo, persona.juntaId, recintoActual)}
      </p>

      <form onSubmit={submit}>
        <div class="g-mover-campos">
          <label class="g-mil-campo">
            Responsabilidad
            <select
              value={clase}
              disabled={enviando}
              onChange={(e) =>
                cambiarClase(
                  (e.currentTarget as HTMLSelectElement).value as Clase,
                )
              }
            >
              {CLASES.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CLASE[c]}
                </option>
              ))}
            </select>
          </label>
          <label class="g-mil-campo g-mil-campo-ancho">
            Recinto
            <select
              value={recintoCod}
              disabled={enviando}
              onChange={(e) =>
                cambiarRecinto(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                )
              }
            >
              <option value="">
                {clase === "cda"
                  ? "Elige un recinto CDA…"
                  : "Elige un recinto…"}
              </option>
              {grupos.map((g) => (
                <optgroup key={g.nombre} label={g.nombre}>
                  {g.items.map((r) => (
                    <option key={r.cod} value={r.cod}>
                      {title(r.nombre)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {clase === "veedor" ? (
            <label class="g-mil-campo g-mil-campo-ancho">
              Junta
              <select
                value={junta}
                disabled={enviando || !recinto}
                onChange={(e) => {
                  setJunta((e.currentTarget as HTMLSelectElement).value);
                  setError(null);
                }}
              >
                <option value={AUTO}>Primera disponible</option>
                {juntas.map((j) => {
                  const actual = j.juntaId === persona.juntaId;
                  const completa = j.titular && j.suplente;
                  const estadoTxt = actual
                    ? "actual"
                    : completa
                      ? "completa"
                      : j.titular
                        ? `titular: ${j.titular}`
                        : "libre";
                  return (
                    <option
                      key={j.juntaId}
                      value={j.juntaId}
                      disabled={Boolean(completa) && !actual}
                    >
                      {etiquetaJunta(j.juntaId)} · {estadoTxt}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
        </div>

        <p
          class={plan.ok ? "g-mover-plan" : "g-mover-plan g-mover-plan-no"}
          role="status"
        >
          {plan.ok ? (
            <>
              Quedará como{" "}
              <strong>
                {PUESTO_CLASE[plan.clase]} {plan.rol}
              </strong>
              {plan.clase === "veedor" && plan.juntaId ? (
                <> de la junta {etiquetaJunta(plan.juntaId)}</>
              ) : null}
              {" en "}
              {title(
                recintos.find((r) => r.cod === plan.recintoCodigo)?.nombre ??
                  "",
              )}
              {plan.titular ? <>; el titular es {plan.titular}</> : null}.
            </>
          ) : (
            plan.motivo
          )}
        </p>

        <section class="g-mover-cercanos" aria-labelledby="g-mover-cercanos-t">
          <h4 id="g-mover-cercanos-t">
            Recintos cercanos con juntas sin veedor
          </h4>
          <p class="g-sub">
            Cerca de {recinto ? title(recinto.nombre) : "su recinto"}: primero
            su parroquia y luego por distancia.
          </p>
          {cercanos.length === 0 ? (
            <p class="g-sub">
              Los recintos cercanos ya tienen veedor titular en todas sus
              juntas.
            </p>
          ) : (
            <ul>
              {cercanos.map((c) => (
                <li key={c.recinto.cod}>
                  <div class="g-mover-cercano">
                    <strong>{title(c.recinto.nombre)}</strong>
                    <small>
                      {c.mismaParroquia
                        ? "Misma parroquia"
                        : (nombreParroquia.get(c.recinto.par) ?? "")}
                      {Number.isFinite(c.km) ? ` · a ${km(c.km)} km` : ""}
                      {` · faltan ${c.faltan} de ${c.total} juntas`}
                    </small>
                  </div>
                  <button
                    type="button"
                    class="g-btn-ghost"
                    disabled={enviando}
                    onClick={() => {
                      setClase("veedor");
                      setRecintoCod(c.recinto.cod);
                      setJunta(AUTO);
                      setError(null);
                    }}
                  >
                    Elegir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error ? <p class="g-error">{error}</p> : null}
        <div class="g-form-actions">
          <button
            type="submit"
            class="g-btn-accion"
            disabled={!plan.ok || enviando}
          >
            {enviando ? "Moviendo…" : "Mover"}
          </button>
          <button
            type="button"
            class="g-btn-ghost"
            disabled={enviando}
            onClick={() => ref.current?.close()}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
