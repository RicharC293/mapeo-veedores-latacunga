import { useMemo, useRef, useState } from "preact/hooks";
import type { DatosValidacion } from "../../lib/validacion/pantalla";
import type { Coincidencia } from "../../lib/validacion/nombres";
import type { ResultadoLote } from "../../lib/validacion/validaciones";

interface Props {
  datosIniciales: DatosValidacion;
  hayClave: boolean;
}

type Filtro = "todos" | Coincidencia;

const ETIQUETA: Record<Coincidencia, string> = {
  igual: "Solo formato",
  parecido: "Parecido",
  distinto: "Distinto",
};
const CLASE: Record<Coincidencia, string> = {
  igual: "chip-estado-ok",
  parecido: "chip-estado-casi",
  distinto: "chip-estado-pendiente",
};

const dolares = (n: number) =>
  `US$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

function VerRespuesta({ respuesta }: { respuesta: unknown }) {
  if (respuesta == null) return null;
  return (
    <details class="g-val-json">
      <summary>Ver respuesta</summary>
      <pre>{JSON.stringify(respuesta, null, 2)}</pre>
    </details>
  );
}

export default function GestionValidacion({ datosIniciales, hayClave }: Props) {
  const [datos, setDatos] = useState(datosIniciales);
  const [tope, setTope] = useState(Math.min(50, datosIniciales.pendientes));
  const [confirmando, setConfirmando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [progreso, setProgreso] = useState<ResultadoLote | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const detenerRef = useRef(false);

  const refrescar = async () => {
    const d = await api<DatosValidacion>("/api/gestion/validacion");
    setDatos(d);
    setTope((t) => Math.min(Math.max(t, 1), d.pendientes));
    setSeleccion(new Set());
  };

  const topeValido = Math.max(0, Math.min(tope || 0, datos.pendientes));
  const costoTope = topeValido * datos.costoPorConsulta;

  const consultar = async () => {
    setConfirmando(false);
    setConsultando(true);
    setError(null);
    setAviso(null);
    detenerRef.current = false;
    const total: ResultadoLote = {
      consultadas: 0,
      validadas: 0,
      noEncontradas: 0,
      conError: 0,
      detenido: null,
      pendientes: datos.pendientes,
    };
    setProgreso(total);
    try {
      while (total.consultadas < topeValido && !detenerRef.current) {
        const r = await api<ResultadoLote>(
          "/api/gestion/validacion/consultar",
          {
            method: "POST",
            body: JSON.stringify({ limite: topeValido - total.consultadas }),
          },
        );
        total.consultadas += r.consultadas;
        total.validadas += r.validadas;
        total.noEncontradas += r.noEncontradas;
        total.conError += r.conError;
        total.pendientes = r.pendientes;
        total.detenido = r.detenido;
        setProgreso({ ...total });
        if (r.detenido || r.consultadas === 0) break;
      }
      setAviso(
        total.detenido
          ? `Se detuvo: ${total.detenido}`
          : detenerRef.current
            ? "Consulta detenida."
            : "Consulta terminada.",
      );
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setConsultando(false);
    }
  };

  const conteos = useMemo(
    () => ({
      todos: datos.revision.length,
      igual: datos.revision.filter((f) => f.coincidencia === "igual").length,
      parecido: datos.revision.filter((f) => f.coincidencia === "parecido")
        .length,
      distinto: datos.revision.filter((f) => f.coincidencia === "distinto")
        .length,
    }),
    [datos.revision],
  );
  const filas = datos.revision.filter(
    (f) => filtro === "todos" || f.coincidencia === filtro,
  );

  const alternar = (cedula: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(cedula)) s.delete(cedula);
      else s.add(cedula);
      return s;
    });

  const aplicar = async (cedulas: string[]) => {
    if (cedulas.length === 0) return;
    setAplicando(true);
    setError(null);
    try {
      const r = await api<{ aplicadas: number }>(
        "/api/gestion/validacion/aplicar",
        {
          method: "POST",
          body: JSON.stringify({ cedulas }),
        },
      );
      setAviso(
        `Se aplicó el nombre oficial a ${r.aplicadas} ${r.aplicadas === 1 ? "persona" : "personas"}.`,
      );
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div class="g-panel g-val">
      <dl class="g-val-cifras">
        <div>
          <dt>Personas en el sistema</dt>
          <dd>{datos.personas}</dd>
        </div>
        <div>
          <dt>Validadas</dt>
          <dd>{datos.validadas}</dd>
        </div>
        <div>
          <dt>No encontradas</dt>
          <dd>{datos.noEncontradas}</dd>
        </div>
        <div>
          <dt>Por consultar</dt>
          <dd>
            {datos.pendientes}{" "}
            <small>
              ≈ {dolares(datos.pendientes * datos.costoPorConsulta)}
            </small>
          </dd>
        </div>
        <div>
          <dt>Cédula inválida (no se consultan)</dt>
          <dd>{datos.invalidas.length}</dd>
        </div>
      </dl>

      <section class="g-val-seccion" aria-labelledby="val-consultar">
        <h2 id="val-consultar">Consultar cédulas</h2>
        {!hayClave ? (
          <p class="g-error">
            Falta configurar la clave ECUADORAPI_KEY en el servidor. Sin ella no
            se puede consultar.
          </p>
        ) : datos.pendientes === 0 ? (
          <p class="g-sub">Todas las cédulas válidas ya fueron consultadas.</p>
        ) : (
          <>
            <p class="g-sub">
              Se consultan primero coordinadores, CDA y veedores, y luego
              Militancia. Las que dan error técnico se reintentan en la
              siguiente consulta; las demás no se repiten.
            </p>
            <div class="g-val-consulta">
              <label>
                Cuántas consultar ahora
                <input
                  type="number"
                  min={1}
                  max={datos.pendientes}
                  value={tope}
                  disabled={consultando}
                  onInput={(e) =>
                    setTope(Number((e.currentTarget as HTMLInputElement).value))
                  }
                />
              </label>
              {consultando ? (
                <button
                  type="button"
                  class="g-btn-ghost"
                  onClick={() => (detenerRef.current = true)}
                >
                  Detener
                </button>
              ) : confirmando ? (
                <div
                  class="g-val-confirmar"
                  role="alertdialog"
                  aria-label="Confirmar consulta"
                >
                  <span>
                    Se cobrarán hasta <strong>{dolares(costoTope)}</strong> por{" "}
                    {topeValido} consultas.
                  </span>
                  <button
                    type="button"
                    class="g-btn-accion"
                    onClick={consultar}
                  >
                    Sí, consultar
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
                <button
                  type="button"
                  class="g-btn-accion"
                  disabled={topeValido === 0}
                  onClick={() => setConfirmando(true)}
                >
                  Consultar {topeValido} (≈ {dolares(costoTope)})
                </button>
              )}
            </div>
          </>
        )}
        {progreso ? (
          <p class="g-val-progreso" role="status">
            {progreso.consultadas} de {topeValido || progreso.consultadas}{" "}
            consultadas · {progreso.validadas} validadas ·{" "}
            {progreso.noEncontradas} no encontradas · {progreso.conError} con
            error
          </p>
        ) : null}
        {aviso ? <p role="status">{aviso}</p> : null}
        {error ? <p class="g-error">{error}</p> : null}
      </section>

      <section class="g-val-seccion" aria-labelledby="val-revision">
        <h2 id="val-revision">Nombres por corregir</h2>
        {datos.revision.length === 0 ? (
          <p class="g-sub">
            Todos los nombres validados ya están en el formato oficial.
          </p>
        ) : (
          <>
            <p class="g-sub">
              Nombre en el sistema frente al oficial, en formato "Nombres
              Apellidos". "Solo formato" cambia mayúsculas, tildes u orden;
              "Distinto" puede ser otra persona o una cédula mal digitada:
              revísalo antes de aplicar.
            </p>
            <div class="g-mil-chips" role="group" aria-label="Filtrar">
              {(["todos", "igual", "parecido", "distinto"] as const).map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    class="g-chip-filtro"
                    aria-pressed={filtro === c}
                    onClick={() => setFiltro(c)}
                  >
                    {c === "todos" ? "Todos" : ETIQUETA[c]}
                    <span class="g-chip-filtro-n">{conteos[c]}</span>
                  </button>
                ),
              )}
            </div>
            <div class="g-val-acciones">
              <button
                type="button"
                class="g-btn-accion"
                disabled={aplicando || seleccion.size === 0}
                onClick={() => aplicar([...seleccion])}
              >
                Aplicar a los seleccionados ({seleccion.size})
              </button>
              {conteos.igual > 0 ? (
                <button
                  type="button"
                  class="g-btn-ghost"
                  disabled={aplicando}
                  onClick={() =>
                    aplicar(
                      datos.revision
                        .filter((f) => f.coincidencia === "igual")
                        .map((f) => f.cedula),
                    )
                  }
                >
                  Aplicar todos los de solo formato ({conteos.igual})
                </button>
              ) : null}
            </div>
            <div class="g-table-scroll">
              <table class="g-table g-val-tabla">
                <thead>
                  <tr>
                    <th>
                      <span class="g-sr-only">Seleccionar</span>
                    </th>
                    <th>Cédula</th>
                    <th>En el sistema</th>
                    <th>Oficial</th>
                    <th>Coincidencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.cedula}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${f.oficial}`}
                          checked={seleccion.has(f.cedula)}
                          onChange={() => alternar(f.cedula)}
                        />
                      </td>
                      <td class="g-val-cedula">
                        {f.cedula}
                        <small>{f.donde.join(" · ")}</small>
                      </td>
                      <td>
                        {f.registrados.map((n) => (
                          <span key={n} class="g-val-nombre">
                            {n}
                          </span>
                        ))}
                      </td>
                      <td>
                        <strong>{f.oficial}</strong>
                        <VerRespuesta respuesta={f.respuesta} />
                      </td>
                      <td>
                        <span class={`chip-estado ${CLASE[f.coincidencia]}`}>
                          {ETIQUETA[f.coincidencia]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {datos.noEncontradasDetalle.length > 0 ? (
        <section class="g-val-seccion" aria-labelledby="val-noencontradas">
          <h2 id="val-noencontradas">No encontradas en el Registro Civil</h2>
          <p class="g-sub">
            La API no devolvió datos de estas cédulas. Revisa si están mal
            digitadas y corrígelas donde consten.
          </p>
          <ul class="g-val-lista">
            {datos.noEncontradasDetalle.map((d) => (
              <li key={d.persona.cedula}>
                <strong>{d.persona.nombres.join(" / ")}</strong>
                <small>
                  CI {d.persona.cedula} · {d.persona.donde.join(" · ")}
                  {d.error ? ` · ${d.error}` : ""}
                </small>
                <VerRespuesta respuesta={d.respuesta} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {datos.invalidas.length > 0 ? (
        <section class="g-val-seccion" aria-labelledby="val-invalidas">
          <h2 id="val-invalidas">Cédulas inválidas (no se consultan)</h2>
          <p class="g-sub">
            No pasan el dígito verificador: la API las rechazaría y se cobraría
            igual. Corrígelas primero donde consten.
          </p>
          <ul class="g-val-lista">
            {datos.invalidas.map((p) => (
              <li key={p.cedula}>
                <strong>{p.nombres.join(" / ")}</strong>
                <small>
                  CI {p.cedula} · {p.donde.join(" · ")}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
