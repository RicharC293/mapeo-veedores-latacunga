import { useMemo, useState } from "preact/hooks";
import GraficoBarrasCobertura from "./GraficoBarrasCobertura";
import GraficoDona from "./GraficoDona";
import GraficoResponsables from "./GraficoResponsables";
import { sumar } from "../../lib/gestion/cifras";
import type { FilaRecinto } from "../../lib/gestion/cifras";
import {
  ETIQUETA_ROL,
  MODOS,
  barras,
  claveCifras,
  filtrarRecintos,
  personasDelAlcance,
  porcentaje,
  segmentos,
  type Alcance,
  type Ambito,
  type Modo,
  type Rol,
} from "../../lib/gestion/tablero";
import { fmt, title } from "../../lib/format";
import type { Lider } from "../../lib/gestion/types";

interface ParroquiaOpcion {
  code: number;
  name: string;
  urbana: boolean;
}

interface PersonaTablero {
  recintoCodigo: number;
  responsableLiderId: string | null;
  verificado: boolean;
}

interface Props {
  filas: FilaRecinto[];
  parroquias: ParroquiaOpcion[];
  lideres: Lider[];
  veedores: PersonaTablero[];
  coordinadores: PersonaTablero[];
  acreditados: PersonaTablero[];
}

const ROLES: Rol[] = ["general", "veedores", "coordinadores", "cda"];

// Qué mide cada gráfico, en una línea, bajo el título.
const DESCRIPCION: Record<Rol, string> = {
  general:
    "Cobertura completa: una junta cuenta si tiene veedor titular y su recinto tiene coordinador titular. Se compara con los puestos de cada rol.",
  veedores: "Un veedor titular por junta, sin mirar el coordinador.",
  coordinadores: "Un coordinador titular por recinto.",
  cda: "Un acreditado titular por recinto CDA.",
};

const SERIE_POR_MODO: Record<Modo, string> = {
  ingresados: "Ingresados",
  verificados: "Verificados",
  sinverificar: "Ingresados sin verificar",
};

interface SeccionProps {
  rol: Rol;
  modo: Modo;
  filas: FilaRecinto[];
  parroquias: ParroquiaOpcion[];
  lideres: Lider[];
  personas: PersonaTablero[] | null;
}

function Seccion({
  rol,
  modo,
  filas,
  parroquias,
  lideres,
  personas,
}: SeccionProps) {
  const [alcance, setAlcance] = useState<Alcance>({
    ambito: "todas",
    parroquia: "",
    recinto: "",
  });
  const clave = claveCifras(rol);
  // El recinto solo se elige en veedores (sus juntas) y en el general.
  const conRecinto = rol === "veedores" || rol === "general";

  const filtradas = useMemo(
    () => filtrarRecintos(filas, alcance),
    [filas, alcance],
  );
  const totales = useMemo(() => sumar(filtradas)[clave], [filtradas, clave]);

  const parroquiasOpciones = useMemo(() => {
    const conPuesto = new Set(
      filas.filter((f) => f[clave].requerido > 0).map((f) => f.parroquiaCodigo),
    );
    return parroquias
      .filter((p) => conPuesto.has(p.code))
      .filter((p) =>
        alcance.ambito === "todas"
          ? true
          : p.urbana === (alcance.ambito === "urbanas"),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filas, parroquias, clave, alcance.ambito]);

  const recintosOpciones = useMemo(
    () =>
      alcance.parroquia === ""
        ? []
        : filas
            .filter((f) => f.parroquiaCodigo === alcance.parroquia)
            .sort((a, b) => a.recinto.localeCompare(b.recinto)),
    [filas, alcance.parroquia],
  );

  const grafica = useMemo(
    () => barras(filtradas, rol, modo, alcance, (f) => title(f.recinto)),
    [filtradas, rol, modo, alcance],
  );
  const partes = useMemo(() => segmentos(totales, modo), [totales, modo]);
  const personasFiltradas = useMemo(
    () => (personas ? personasDelAlcance(personas, filtradas, modo) : []),
    [personas, filtradas, modo],
  );

  const nombreRol = ETIQUETA_ROL[rol];
  const desglose =
    rol === "general"
      ? "por rol"
      : alcance.recinto !== ""
        ? "del recinto"
        : alcance.parroquia !== ""
          ? "por recinto"
          : "por parroquia";

  return (
    <section class="g-cobertura-track" aria-labelledby={`cob-${rol}`}>
      <h2 id={`cob-${rol}`}>{nombreRol}</h2>
      <p class="g-sub">{DESCRIPCION[rol]}</p>

      <div class="g-panel">
        <div class="g-selects">
          <label>
            Ámbito
            <select
              value={alcance.ambito}
              onChange={(e) =>
                setAlcance({
                  ambito: (e.currentTarget as HTMLSelectElement)
                    .value as Ambito,
                  parroquia: "",
                  recinto: "",
                })
              }
            >
              <option value="todas">Todos</option>
              <option value="urbanas">Solo urbanas</option>
              <option value="rurales">Solo rurales</option>
            </select>
          </label>
          <label>
            Parroquia
            <select
              value={alcance.parroquia}
              onChange={(e) =>
                setAlcance({
                  ...alcance,
                  parroquia:
                    Number((e.currentTarget as HTMLSelectElement).value) || "",
                  recinto: "",
                })
              }
            >
              <option value="">Todas</option>
              {parroquiasOpciones.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {conRecinto ? (
            <label>
              Recinto
              <select
                value={alcance.recinto}
                disabled={alcance.parroquia === ""}
                onChange={(e) =>
                  setAlcance({
                    ...alcance,
                    recinto:
                      Number((e.currentTarget as HTMLSelectElement).value) ||
                      "",
                  })
                }
              >
                <option value="">
                  {alcance.parroquia === "" ? "Elige una parroquia" : "Todos"}
                </option>
                {recintosOpciones.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {title(r.recinto)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div class="g-summary">
          <div class="g-summary-item">
            <b>
              {fmt(totales.ingresados)} / {fmt(totales.requerido)}
            </b>
            <small>ingresados ({totales.pct}%)</small>
          </div>
          <div class="g-summary-item">
            <b>
              {fmt(totales.verificados)} / {fmt(totales.requerido)}
            </b>
            <small>verificados ({porcentaje(totales, "verificados")}%)</small>
          </div>
          <div class="g-summary-item">
            <b>{fmt(totales.faltan)}</b>
            <small>faltan por ingresar</small>
          </div>
        </div>
      </div>

      <p class="g-tablero-titulo">
        {SERIE_POR_MODO[modo]} {desglose}
      </p>
      {grafica.length === 0 ? (
        <p class="g-empty">
          No hay datos de {nombreRol.toLowerCase()} para este filtro.
        </p>
      ) : (
        <>
          <div class="g-cobertura-barras">
            <GraficoBarrasCobertura
              barras={grafica}
              modo={modo}
              serie={SERIE_POR_MODO[modo]}
            />
          </div>
          <div class="g-cobertura-lateral">
            <GraficoDona segmentos={partes} modo={modo} titulo={nombreRol} />
            {personas ? (
              <GraficoResponsables
                titulo={nombreRol}
                lideres={lideres}
                personas={personasFiltradas}
                modo={modo}
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

export default function TableroCobertura({
  filas,
  parroquias,
  lideres,
  veedores,
  coordinadores,
  acreditados,
}: Props) {
  const [modo, setModo] = useState<Modo>("ingresados");
  const personasDe: Record<Rol, PersonaTablero[] | null> = {
    general: null,
    veedores,
    coordinadores,
    cda: acreditados,
  };

  return (
    <div class="g-tablero">
      <div class="g-tablero-modo">
        <label>
          Mostrar en los gráficos
          <select
            value={modo}
            onChange={(e) =>
              setModo((e.currentTarget as HTMLSelectElement).value as Modo)
            }
          >
            {MODOS.map((m) => (
              <option key={m.clave} value={m.clave}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <p class="g-sub">
          {modo === "ingresados"
            ? "Cuenta a todos los titulares registrados, estén o no verificados."
            : modo === "verificados"
              ? "Cuenta solo a los titulares que ya fueron contactados y verificados."
              : "Cuenta a los titulares registrados que todavía no se verificaron."}{" "}
          El porcentaje es sobre los puestos que se necesitan.
        </p>
      </div>

      {ROLES.map((rol) => (
        <Seccion
          key={rol}
          rol={rol}
          modo={modo}
          filas={filas}
          parroquias={parroquias}
          lideres={lideres}
          personas={personasDe[rol]}
        />
      ))}
    </div>
  );
}
