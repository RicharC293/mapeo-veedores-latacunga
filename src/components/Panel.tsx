import { useMemo } from "preact/hooks";
import { view } from "../lib/state";
import { selectCanton, selectParroquia, selectRecinto } from "../lib/state";
import {
  buildParByCode,
  buildParroquiaStats,
  buildTotales,
} from "../lib/stats";
import { fmt, normalizar, rango, title } from "../lib/format";
import type {
  MapData,
  ParroquiaFeature,
  ParroquiaStats,
  Recinto,
} from "../lib/types";
import type { Coordinador, Lider } from "../lib/gestion/types";

interface Props {
  data: MapData;
  lideres: Lider[];
  coordinadores: Coordinador[];
}

function nombreLider(lideres: Lider[], recinto: Recinto): string {
  const especificos = lideres.filter(
    (l) => l.ambito === "parroquia" && l.recintoCodigos.includes(recinto.cod),
  );
  const relevantes =
    especificos.length > 0
      ? especificos
      : lideres.filter(
          (l) => l.ambito === "parroquia" && l.parroquiaCodigo === recinto.par,
        );
  return relevantes.length > 0
    ? relevantes.map((l) => l.nombres).join(", ")
    : "Sin asignar";
}

function nombreCoordinador(
  coordinadores: Coordinador[],
  recintoCodigo: number,
): string {
  const titular = coordinadores.find(
    (c) => c.recintoCodigo === recintoCodigo && c.tipo === "titular",
  );
  return titular ? titular.nombres : "Sin asignar";
}

export default function Panel({ data, lideres, coordinadores }: Props) {
  const v = view.value;
  const parByCode = useMemo(() => buildParByCode(data), [data]);
  const stats = useMemo(() => buildParroquiaStats(data), [data]);
  const totales = useMemo(() => buildTotales(data), [data]);

  if (v.kind === "canton") {
    const byType = (u: boolean) =>
      data.parroquias.features
        .filter((f) => f.properties.urbana === u)
        .sort(
          (a, b) => stats[b.properties.code].el - stats[a.properties.code].el,
        );
    return (
      <>
        <h2>Cantón Latacunga</h2>
        <p class="sub">
          Toca una parroquia en el mapa o en la lista para ver sus recintos.
        </p>
        <div class="stats">
          <div class="stat">
            <b>{data.recintos.length}</b>
            <small>recintos</small>
          </div>
          <div class="stat">
            <b>{fmt(totales.el)}</b>
            <small>electores</small>
          </div>
          <div class="stat">
            <b>{totales.jt}</b>
            <small>
              juntas ({totales.jf} F, {totales.jm} M)
            </small>
          </div>
        </div>
        <h3>Parroquias urbanas</h3>
        <ul class="list">
          {byType(true).map((f) => (
            <ParroquiaRow
              key={f.properties.code}
              f={f}
              stats={stats[f.properties.code]}
            />
          ))}
        </ul>
        <h3>Parroquias rurales</h3>
        <ul class="list">
          {byType(false).map((f) => (
            <ParroquiaRow
              key={f.properties.code}
              f={f}
              stats={stats[f.properties.code]}
            />
          ))}
        </ul>
        <p class="foot">
          Fuente: distributivo de recintos del CNE, corte al 11 de agosto de
          2026 (Elecciones Seccionales y CPCCS 2027). Los límites parroquiales
          son aproximados.
        </p>
      </>
    );
  }

  if (v.kind === "parroquia") {
    const f = parByCode.get(v.code);
    const s = stats[v.code];
    if (!f) return null;
    const recs = data.recintos
      .filter((r) => r.par === v.code)
      .sort((a, b) => b.el - a.el);
    return (
      <>
        <button class="back" onClick={() => selectCanton(true)}>
          ‹ Todo el cantón
        </button>
        <h2>{f.properties.name}</h2>
        <p class="sub">Parroquia {f.properties.urbana ? "urbana" : "rural"}</p>
        <div class="stats">
          <div class="stat">
            <b>{s.rec}</b>
            <small>{s.rec === 1 ? "recinto" : "recintos"}</small>
          </div>
          <div class="stat">
            <b>{fmt(s.el)}</b>
            <small>electores</small>
          </div>
          <div class="stat">
            <b>{s.jt}</b>
            <small>
              juntas ({s.jf} F, {s.jm} M)
            </small>
          </div>
        </div>
        <h3>Recintos</h3>
        <ul class="list">
          {recs.map((r) => (
            <RecintoRow
              key={r.cod}
              r={r}
              showParish={false}
              parByCode={parByCode}
            />
          ))}
        </ul>
      </>
    );
  }

  if (v.kind === "recinto") {
    const r = data.recintos.find((x) => x.cod === v.cod);
    const f = r ? parByCode.get(r.par) : undefined;
    if (!r || !f) return null;
    const maps = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`;
    return (
      <>
        <button class="back" onClick={() => selectParroquia(r.par, true)}>
          ‹ {f.properties.name.replace(/ \(.*\)/, "")}
        </button>
        <h2>{title(r.nombre)}</h2>
        <p class="sub">{title(r.dir)}</p>
        <div class="juntas">
          <div>
            <b>{r.jf}</b>
            <small>
              femeninas
              <br />
              {r.jf ? rango(r.fi, r.ff) : "Sin juntas"}
            </small>
          </div>
          <div>
            <b>{r.jm}</b>
            <small>
              masculinas
              <br />
              {r.jm ? rango(r.mi, r.mf) : "Sin juntas"}
            </small>
          </div>
        </div>
        <dl>
          <dt>Electores</dt>
          <dd>{fmt(r.el)}</dd>
          <dt>Total de juntas</dt>
          <dd>{r.jt}</dd>
          <dt>Parroquia</dt>
          <dd>{f.properties.name}</dd>
          <dt>Líder</dt>
          <dd>{nombreLider(lideres, r)}</dd>
          <dt>Coordinador de recinto</dt>
          <dd>{nombreCoordinador(coordinadores, r.cod)}</dd>
          {r.zona ? (
            <>
              <dt>Zona electoral</dt>
              <dd>{title(r.zona)}</dd>
            </>
          ) : null}
          <dt>Código CNE</dt>
          <dd>{r.cod}</dd>
          <dt>Teléfono</dt>
          <dd>
            {r.tel ? (
              <a href={`tel:${r.tel}`} style={{ color: "inherit" }}>
                {r.tel}
              </a>
            ) : (
              "No registrado"
            )}
          </dd>
          <dt>Centro de digitalización de actas (CDA)</dt>
          <dd>{r.cda ? "Sí" : "No"}</dd>
          <dt>Difícil acceso</dt>
          <dd>{r.dif ? "Sí" : "No"}</dd>
          <dt>Sin conectividad</dt>
          <dd>{r.sinc ? "Sí" : "No"}</dd>
        </dl>
        <a class="go" href={maps} target="_blank" rel="noopener">
          Cómo llegar en Google Maps
        </a>
      </>
    );
  }

  const t = normalizar(v.query);
  const hits = data.recintos.filter((r) =>
    normalizar(`${r.nombre} ${r.dir} ${r.cod}`).includes(t),
  );
  return (
    <>
      <h3>
        {hits.length} {hits.length === 1 ? "resultado" : "resultados"}
      </h3>
      {hits.length ? (
        <ul class="list">
          {hits.map((r) => (
            <RecintoRow key={r.cod} r={r} showParish parByCode={parByCode} />
          ))}
        </ul>
      ) : (
        <p class="empty">
          No hay recintos con ese nombre o dirección. Prueba con otra palabra,
          por ejemplo el nombre de la escuela o la calle.
        </p>
      )}
    </>
  );
}

function ParroquiaRow({
  f,
  stats: s,
}: {
  f: ParroquiaFeature;
  stats: ParroquiaStats;
}) {
  return (
    <li>
      <button
        class="row"
        onClick={() => selectParroquia(f.properties.code, true)}
      >
        <span class="t">
          <strong>{f.properties.name}</strong>
          <small>
            {s.rec} {s.rec === 1 ? "recinto" : "recintos"}, {s.jt} juntas
          </small>
        </span>
        <span class="n">
          {fmt(s.el)}
          <small>electores</small>
        </span>
      </button>
    </li>
  );
}

function RecintoRow({
  r,
  showParish,
  parByCode,
}: {
  r: Recinto;
  showParish: boolean;
  parByCode: Map<number, ParroquiaFeature>;
}) {
  const parish = parByCode.get(r.par);
  const p = parish ? parish.properties.name.replace(/ \(.*\)/, "") : "";
  return (
    <li>
      <button class="row" onClick={() => selectRecinto(r.cod, true)}>
        <span class="t">
          <strong>
            {title(r.nombre)}
            {r.cda ? (
              <span class="tag" title="Centro de digitalización de actas">
                CDA
              </span>
            ) : null}
          </strong>
          <small>
            {showParish ? `${p}, ` : ""}
            {title(r.dir)}
          </small>
        </span>
        <span class="n">
          {r.jt}
          <small>juntas</small>
        </span>
      </button>
    </li>
  );
}
