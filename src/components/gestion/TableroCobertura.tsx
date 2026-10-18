import { useMemo, useState } from "preact/hooks";
import GraficoBarrasCobertura from "./GraficoBarrasCobertura";
import GraficoDona from "./GraficoDona";
import GraficoResponsables from "./GraficoResponsables";
import { sumar } from "../../lib/gestion/cifras";
import type { FilaRecinto } from "../../lib/gestion/cifras";
import {
  COLOR_SIN_VERIFICAR,
  COLOR_VERIFICADO,
} from "../../lib/gestion/chartColors";
import {
  ETIQUETA_ROL,
  MODOS,
  cantidad,
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

const pctTxt = (n: number) =>
  `${n.toLocaleString("es-EC", { maximumFractionDigits: 1 })} %`;

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
    <section class="g-cob-seccion" aria-labelledby={`cob-${rol}`}>
      <header class="g-cob-cabecera">
        <h2 id={`cob-${rol}`}>{nombreRol}</h2>
        <p>{DESCRIPCION[rol]}</p>
      </header>

      <div class="g-selects g-cob-filtros">
        <label>
          Ámbito
          <select
            value={alcance.ambito}
            onChange={(e) =>
              setAlcance({
                ambito: (e.currentTarget as HTMLSelectElement).value as Ambito,
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
                    Number((e.currentTarget as HTMLSelectElement).value) || "",
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

      <dl class="g-cob-cifras">
        <div>
          <dt>
            <i class="g-cob-punto g-cob-punto-ingresados" aria-hidden="true" />
            Ingresados
          </dt>
          <dd>
            {fmt(totales.ingresados)} <span>de {fmt(totales.requerido)}</span>{" "}
            <small>{pctTxt(totales.pct)}</small>
          </dd>
        </div>
        <div>
          <dt>
            <i class="g-cob-punto g-cob-punto-verificados" aria-hidden="true" />
            Verificados
          </dt>
          <dd>
            {fmt(totales.verificados)} <span>de {fmt(totales.requerido)}</span>{" "}
            <small>{pctTxt(porcentaje(totales, "verificados"))}</small>
          </dd>
        </div>
        <div>
          <dt>
            <i class="g-cob-punto g-cob-punto-faltan" aria-hidden="true" />
            Faltan por ingresar
          </dt>
          <dd>
            {fmt(totales.faltan)} <small>{pctTxt(totales.pctFaltante)}</small>
          </dd>
        </div>
      </dl>

      {grafica.length === 0 ? (
        <p class="g-empty">
          No hay datos de {nombreRol.toLowerCase()} para este filtro.
        </p>
      ) : (
        <div class={`g-cob-grid${personas ? "" : " g-cob-grid-solo"}`}>
          <div class="g-cob-barras">
            <h3>
              {SERIE_POR_MODO[modo]} {desglose}
            </h3>
            <GraficoBarrasCobertura
              barras={grafica}
              modo={modo}
              serie={SERIE_POR_MODO[modo]}
            />
          </div>
          <div class="g-cob-dona">
            <h3>Avance total</h3>
            <GraficoDona segmentos={partes} modo={modo} titulo={nombreRol} />
          </div>
          {personas ? (
            <div class="g-cob-resp">
              <h3>Por responsable</h3>
              <GraficoResponsables
                titulo={nombreRol}
                lideres={lideres}
                personas={personasFiltradas}
                modo={modo}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

interface SeccionRecintosProps {
  modo: Modo;
  filas: FilaRecinto[];
  parroquias: ParroquiaOpcion[];
}

const COLOR_BARRA_AZUL = "#2a78d6";

// Cada recinto con lo que tiene de cada rol, según el modo elegido arriba.
// Sirve para decidir dónde mandar gente: arriba van los recintos a los que
// más puestos les faltan por cubrir.
function SeccionRecintos({ modo, filas, parroquias }: SeccionRecintosProps) {
  const [ambito, setAmbito] = useState<Ambito>("todas");
  const [parroquia, setParroquia] = useState<number | "">("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  const parroquiasOpciones = useMemo(
    () =>
      parroquias
        .filter((p) =>
          ambito === "todas" ? true : p.urbana === (ambito === "urbanas"),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [parroquias, ambito],
  );

  const color =
    modo === "verificados"
      ? COLOR_VERIFICADO
      : modo === "sinverificar"
        ? COLOR_SIN_VERIFICAR
        : COLOR_BARRA_AZUL;

  const lista = useMemo(() => {
    const puestos = (f: FilaRecinto) =>
      f.veedores.requerido + f.coordinadores.requerido + f.cda.requerido;
    const cubiertos = (f: FilaRecinto) =>
      cantidad(f.veedores, modo) +
      cantidad(f.coordinadores, modo) +
      cantidad(f.cda, modo);
    return filtrarRecintos(filas, { ambito, parroquia, recinto: "" })
      .map((f) => ({ f, faltan: puestos(f) - cubiertos(f) }))
      .filter((x) => !soloPendientes || x.faltan > 0)
      .sort(
        (a, b) =>
          b.faltan - a.faltan ||
          a.f.parroquia.localeCompare(b.f.parroquia) ||
          a.f.recinto.localeCompare(b.f.recinto),
      );
  }, [filas, ambito, parroquia, soloPendientes, modo]);

  const celda = (c: FilaRecinto["veedores"], barra = false) => {
    if (c.requerido === 0) return "—";
    const n = cantidad(c, modo);
    return (
      <>
        {barra ? (
          <span class="g-bar g-cob-mini" aria-hidden="true">
            <span
              style={`width:${porcentaje(c, modo)}%; background:${color}`}
            />
          </span>
        ) : null}
        <span class="g-cob-cant">
          {n} <span>/ {c.requerido}</span>
        </span>
      </>
    );
  };

  return (
    <section class="g-cob-seccion" aria-labelledby="cob-recintos">
      <header class="g-cob-cabecera">
        <h2 id="cob-recintos">Por recinto</h2>
        <p>
          Cada recinto con sus veedores (de sus juntas), su coordinador y, si es
          CDA, su acreditado, según el modo de arriba. Los que más puestos
          necesitan van primero.
        </p>
      </header>
      <div class="g-selects g-cob-filtros">
        <label>
          Ámbito
          <select
            value={ambito}
            onChange={(e) => {
              setAmbito((e.currentTarget as HTMLSelectElement).value as Ambito);
              setParroquia("");
            }}
          >
            <option value="todas">Todos</option>
            <option value="urbanas">Solo urbanas</option>
            <option value="rurales">Solo rurales</option>
          </select>
        </label>
        <label>
          Parroquia
          <select
            value={parroquia}
            onChange={(e) =>
              setParroquia(
                Number((e.currentTarget as HTMLSelectElement).value) || "",
              )
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
        <label class="g-cob-check">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) =>
              setSoloPendientes((e.currentTarget as HTMLInputElement).checked)
            }
          />
          Solo con puestos por cubrir
        </label>
      </div>
      {lista.length === 0 ? (
        <p class="g-empty">No hay recintos para este filtro.</p>
      ) : (
        <div class="g-table-scroll">
          <table class="g-table g-cob-tabla">
            <caption class="g-sr-only">
              Veedores, coordinador y acreditado CDA de cada recinto
            </caption>
            <thead>
              <tr>
                <th>Recinto</th>
                <th>Veedores</th>
                <th>Coordinador</th>
                <th>CDA</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ f }) => (
                <tr key={f.codigo}>
                  <td>
                    <span class="g-cob-recinto">{title(f.recinto)}</span>
                    <small>{f.parroquia}</small>
                  </td>
                  <td>{celda(f.veedores, true)}</td>
                  <td>{celda(f.coordinadores)}</td>
                  <td>{celda(f.cda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <p>
          {modo === "ingresados"
            ? "Todos los titulares registrados, estén o no verificados."
            : modo === "verificados"
              ? "Solo los titulares ya contactados y verificados."
              : "Titulares registrados que aún no se verifican."}{" "}
          <span>Porcentajes sobre los puestos que se necesitan.</span>
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

      <SeccionRecintos modo={modo} filas={filas} parroquias={parroquias} />
    </div>
  );
}
