import { useMemo, useState } from "preact/hooks";
import { listJuntasDeRecinto } from "../../lib/gestion/juntas";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Lider, Militante, TipoMilitancia } from "../../lib/gestion/types";
import type {
  AsignarDestino,
  ResultadoAsignacion,
} from "../../lib/gestion/militancia";
import DialogoAsignacion, { type AvisoAsignacion } from "./DialogoAsignacion";
import {
  MENSAJE_ERROR,
  erroresMilitante,
  type ErroresMilitante,
} from "../../lib/gestion/validacionMilitante";

interface Props {
  militante: Militante;
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  lideres: Lider[];
  onAsignar: (
    destino: AsignarDestino,
    confirmarSuplente: boolean,
  ) => Promise<ResultadoAsignacion>;
  onEditar: (patch: {
    cedula: string;
    nombres: string;
    telefono: string;
    email: string;
    preferencia: string;
  }) => Promise<void>;
  onEliminar: () => Promise<void>;
}

type Borrador = {
  cedula: string;
  nombres: string;
  telefono: string;
  email: string;
  preferencia: string;
};

const ETIQUETA: Record<keyof ErroresMilitante, string> = {
  cedula: "Cédula",
  nombres: "Nombres y apellidos",
  telefono: "Celular",
  email: "Correo",
};

function ordenarPorNombre(parroquias: ParroquiaFeature[]) {
  return parroquias
    .slice()
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
}

export default function MilitanteCard({
  militante,
  parroquias,
  recintos,
  lideres,
  onAsignar,
  onEditar,
  onEliminar,
}: Props) {
  const [parroquiaCod, setParroquiaCod] = useState<number | "">(
    militante.parroquiaCodigo ?? "",
  );
  const [recintoCod, setRecintoCod] = useState<number | "">(
    militante.recintoCodigo ?? "",
  );
  const [tipo, setTipo] = useState<TipoMilitancia | "">(
    militante.tipoPreasignado ?? "",
  );
  const [juntaSel, setJuntaSel] = useState(militante.juntaPreasignada ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [aviso, setAviso] = useState<AvisoAsignacion | null>(null);
  const [borrador, setBorrador] = useState<Borrador>({
    cedula: militante.cedula,
    nombres: militante.nombres,
    telefono: militante.telefono,
    email: militante.email,
    preferencia: militante.preferencia,
  });

  const responsable = lideres.find(
    (l) => l.id === militante.responsableLiderId,
  );

  const urbanas = useMemo(
    () => ordenarPorNombre(parroquias.filter((p) => p.properties.urbana)),
    [parroquias],
  );
  const rurales = useMemo(
    () => ordenarPorNombre(parroquias.filter((p) => !p.properties.urbana)),
    [parroquias],
  );

  const recintosDeParroquia = useMemo(
    () =>
      recintos
        .filter((r) => r.par === parroquiaCod)
        .filter((r) => tipo !== "cda" || r.cda)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [recintos, parroquiaCod, tipo],
  );

  const recinto = recintos.find((r) => r.cod === recintoCod) ?? null;
  const juntas = useMemo(
    () => (recinto && tipo === "veedor" ? listJuntasDeRecinto(recinto) : []),
    [recinto, tipo],
  );

  // Mientras se edita, el rojo sigue lo que se está escribiendo; fuera de la
  // edición, lo que está guardado.
  const errores = erroresMilitante(editando ? borrador : militante);

  const faltantes = [
    parroquiaCod === "" ? "parroquia" : null,
    tipo === "" ? "tipo" : null,
    recintoCod === "" ? "recinto" : null,
    tipo === "veedor" && juntaSel === "" ? "junta" : null,
  ].filter(Boolean) as string[];

  const bloqueo = militante.incorrecto
    ? "Corrige los datos marcados en rojo para poder asignar."
    : militante.duplicado
      ? "Esta cédula está repetida: elimina o corrige una de las filas."
      : null;
  const puedeAsignar = !bloqueo && faltantes.length === 0;
  const ayuda =
    bloqueo ??
    (faltantes.length > 0 ? `Falta elegir: ${faltantes.join(", ")}.` : null);

  const ejecutar = async (
    accion: () => Promise<void>,
    alTerminar?: () => void,
  ) => {
    setError(null);
    setEnviando(true);
    try {
      await accion();
      alTerminar?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  };

  // Descripción del lugar elegido, para el aviso de cupos.
  const descripcionLugar = () => {
    const nombre = recinto ? title(recinto.nombre) : "";
    if (tipo === "veedor") {
      const j = juntas.find((x) => x.id === juntaSel);
      return `La junta ${j ? `${j.genero}${j.numero}` : ""} de ${nombre}`;
    }
    return tipo === "cda"
      ? `El CDA de ${nombre}`
      : `La coordinación de ${nombre}`;
  };

  const asignar = (confirmarSuplente = false) => {
    if (!puedeAsignar) return;
    return ejecutar(async () => {
      let destino: AsignarDestino;
      if (tipo === "veedor") {
        const junta = juntas.find((j) => j.id === juntaSel);
        if (!junta) throw new Error("Elige una junta.");
        destino = {
          tipo: "veedor",
          recintoCodigo: recintoCod as number,
          parroquiaCodigo: parroquiaCod as number,
          genero: junta.genero,
          numero: junta.numero,
        };
      } else {
        destino = {
          tipo: tipo as "coordinador" | "cda",
          recintoCodigo: recintoCod as number,
          parroquiaCodigo: parroquiaCod as number,
        };
      }
      const resultado = await onAsignar(destino, confirmarSuplente);
      // Lugar ocupado: se avisa en un diálogo en vez de asignar en silencio.
      if (resultado.estado === "confirmar") {
        setAviso({ tipo: "confirmar", titular: resultado.titular });
      } else if (resultado.estado === "lleno") {
        setAviso({
          tipo: "lleno",
          titular: resultado.titular,
          suplente: resultado.suplente,
        });
      } else {
        setAviso(null);
      }
    });
  };

  const empezarEdicion = () => {
    setBorrador({
      cedula: militante.cedula,
      nombres: militante.nombres,
      telefono: militante.telefono,
      email: militante.email,
      preferencia: militante.preferencia,
    });
    setError(null);
    setConfirmandoBorrar(false);
    setEditando(true);
  };

  const guardarEdicion = () =>
    ejecutar(
      () => onEditar(borrador),
      () => setEditando(false),
    );

  const campoEdicion = (
    clave: keyof Borrador,
    etiqueta: string,
    extra: Record<string, unknown> = {},
    ancho = false,
  ) => {
    const malo = clave !== "preferencia" && errores[clave];
    return (
      <label class={`g-mil-campo${ancho ? " g-mil-campo-ancho" : ""}`}>
        {etiqueta}
        <input
          class={malo ? "g-campo-error" : undefined}
          aria-invalid={malo || undefined}
          title={
            malo ? MENSAJE_ERROR[clave as keyof ErroresMilitante] : undefined
          }
          value={borrador[clave]}
          disabled={enviando}
          onInput={(e) =>
            setBorrador({
              ...borrador,
              [clave]: (e.currentTarget as HTMLInputElement).value,
            })
          }
          {...extra}
        />
        {malo ? (
          <span class="g-mil-error-texto">
            {MENSAJE_ERROR[clave as keyof ErroresMilitante]}
          </span>
        ) : null}
      </label>
    );
  };

  // Dato de solo lectura: en rojo, con el motivo a la vista, si tiene error.
  const dato = (clave: keyof ErroresMilitante, texto: string) => (
    <div class="g-mil-dato">
      <dt>{ETIQUETA[clave]}</dt>
      <dd
        class={errores[clave] ? "g-campo-error" : undefined}
        title={errores[clave] ? MENSAJE_ERROR[clave] : undefined}
      >
        {texto || "—"}
      </dd>
    </div>
  );

  const alerta = militante.incorrecto || militante.duplicado;

  return (
    <li class={`g-mil-card${alerta ? " g-mil-card-alerta" : ""}`}>
      <div class="g-mil-datos">
        {editando ? (
          <div class="g-mil-edicion">
            {campoEdicion("nombres", "Nombres y apellidos", {}, true)}
            {campoEdicion("cedula", "Cédula", { inputMode: "numeric" })}
            {campoEdicion("telefono", "Celular", { inputMode: "tel" })}
            {campoEdicion("email", "Correo", { type: "email" }, true)}
            {campoEdicion("preferencia", "Preferencia (recinto)", {}, true)}
          </div>
        ) : (
          <>
            <div class="g-mil-nombre">
              <strong class={errores.nombres ? "g-campo-error" : undefined}>
                {militante.nombres || "Sin nombre"}
              </strong>
              {militante.incorrecto ? (
                <span class="chip-estado chip-estado-pendiente">
                  Incorrecto
                </span>
              ) : null}
              {militante.duplicado ? (
                <span class="chip-estado chip-estado-pendiente">Duplicado</span>
              ) : null}
            </div>
            <dl class="g-mil-contacto">
              {dato("cedula", militante.cedula)}
              {dato("telefono", militante.telefono)}
              {dato("email", militante.email)}
            </dl>
            <dl class="g-mil-contacto g-mil-meta">
              <div class="g-mil-dato">
                <dt>Responsable</dt>
                <dd>{responsable?.nombres ?? "—"}</dd>
              </div>
              <div class="g-mil-dato">
                <dt>Preferencia</dt>
                <dd>{militante.preferencia || "—"}</dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <div class="g-mil-asignacion">
        <label class="g-mil-campo">
          Parroquia
          <select
            value={parroquiaCod}
            disabled={enviando}
            onChange={(e) => {
              setParroquiaCod(
                Number((e.currentTarget as HTMLSelectElement).value) || "",
              );
              setRecintoCod("");
              setJuntaSel("");
            }}
          >
            <option value="">Selecciona…</option>
            <optgroup label="Urbanas">
              {urbanas.map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Rurales">
              {rurales.map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label class="g-mil-campo">
          Tipo
          <select
            value={tipo}
            disabled={enviando}
            onChange={(e) => {
              const nuevo = (e.currentTarget as HTMLSelectElement).value as
                TipoMilitancia | "";
              setTipo(nuevo);
              // Se conserva el recinto ya elegido o autocompletado; solo se
              // descarta si el nuevo tipo (CDA) no lo admite.
              if (nuevo === "cda" && !recinto?.cda) setRecintoCod("");
              setJuntaSel("");
            }}
          >
            <option value="">Selecciona…</option>
            <option value="veedor">Veedor</option>
            <option value="coordinador">Coordinador</option>
            <option value="cda">Acreditado CDA</option>
          </select>
        </label>
        <label class="g-mil-campo g-mil-campo-ancho">
          Recinto
          <select
            value={recintoCod}
            disabled={enviando || parroquiaCod === ""}
            onChange={(e) => {
              setRecintoCod(
                Number((e.currentTarget as HTMLSelectElement).value) || "",
              );
              setJuntaSel("");
            }}
          >
            <option value="">
              {parroquiaCod === ""
                ? "Primero elige la parroquia"
                : "Selecciona…"}
            </option>
            {recintosDeParroquia.map((r) => (
              <option key={r.cod} value={r.cod}>
                {title(r.nombre)}
              </option>
            ))}
          </select>
        </label>
        {tipo === "veedor" ? (
          <label class="g-mil-campo">
            Junta
            <select
              value={juntaSel}
              disabled={enviando || !recinto}
              onChange={(e) =>
                setJuntaSel((e.currentTarget as HTMLSelectElement).value)
              }
            >
              <option value="">Selecciona…</option>
              {juntas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.genero}
                  {j.numero}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div class="g-mil-acciones">
        {editando ? (
          <>
            <button
              type="button"
              class="g-btn-accion"
              disabled={enviando}
              onClick={guardarEdicion}
            >
              {enviando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              class="g-btn-ghost"
              disabled={enviando}
              onClick={() => {
                setEditando(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
          </>
        ) : confirmandoBorrar ? (
          <>
            <span class="g-mil-confirmar">¿Eliminar a esta persona?</span>
            <button
              type="button"
              class="g-btn-danger-ghost"
              disabled={enviando}
              onClick={() => ejecutar(onEliminar)}
            >
              Eliminar
            </button>
            <button
              type="button"
              class="g-btn-ghost"
              disabled={enviando}
              onClick={() => setConfirmandoBorrar(false)}
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              class="g-btn-accion"
              disabled={!puedeAsignar || enviando}
              onClick={() => asignar()}
            >
              {enviando ? "Asignando…" : "Asignar"}
            </button>
            <div class="g-mil-secundarias">
              <button
                type="button"
                class="g-btn-ghost"
                disabled={enviando}
                onClick={empezarEdicion}
              >
                Editar
              </button>
              <button
                type="button"
                class="g-btn-danger-ghost"
                disabled={enviando}
                onClick={() => setConfirmandoBorrar(true)}
              >
                Eliminar
              </button>
            </div>
          </>
        )}
      </div>

      {aviso ? (
        <DialogoAsignacion
          aviso={aviso}
          lugar={descripcionLugar()}
          persona={militante.nombres}
          seccion={
            tipo === "veedor"
              ? "Veedores"
              : tipo === "cda"
                ? "Acreditados CDA"
                : "Coordinadores"
          }
          enviando={enviando}
          onConfirmar={() => asignar(true)}
          onCerrar={() => setAviso(null)}
        />
      ) : null}

      {!editando && ayuda ? <p class="g-mil-ayuda">{ayuda}</p> : null}
      {error ? <p class="g-error g-mil-ayuda">{error}</p> : null}
    </li>
  );
}
