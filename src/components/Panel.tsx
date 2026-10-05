import { useEffect, useMemo, useState } from "preact/hooks";
import { view } from "../lib/state";
import { selectCanton, selectParroquia, selectRecinto } from "../lib/state";
import {
  buildParByCode,
  buildParroquiaStats,
  buildTotales,
} from "../lib/stats";
import {
  calcularCobertura,
  calcularCoberturaPorParroquia,
} from "../lib/gestion/coverage";
import { responsablesDeRecinto } from "../lib/gestion/responsables";
import { fmt, normalizar, rango, title } from "../lib/format";
import type {
  MapData,
  ParroquiaFeature,
  ParroquiaStats,
  Recinto,
} from "../lib/types";
import type {
  AcreditadoCda,
  CoberturaParroquia,
  CoberturaRecinto,
  Coordinador,
  Lider,
  Veedor,
} from "../lib/gestion/types";
import type { Rol } from "../lib/auth/roles";

interface Props {
  data: MapData;
  lideres: Lider[];
  coordinadores: Coordinador[];
  veedores: Veedor[];
  acreditadosCda: AcreditadoCda[];
  rol: Rol;
}

interface PersonaInfo {
  rol: string;
  label: string;
  nombres: string;
  cedula: string | null;
  telefono: string;
  organizacion?: string;
  asignado: boolean;
}

function coordinadorDe(
  coordinadores: Coordinador[],
  recintoCodigo: number,
): Coordinador | null {
  return (
    coordinadores.find(
      (c) => c.recintoCodigo === recintoCodigo && c.tipo === "titular",
    ) ?? null
  );
}

function personaDe(
  rol: string,
  entidad: {
    nombres: string;
    cedula: string | null;
    telefono: string;
    organizacion?: string;
  },
  label: string = entidad.nombres,
): PersonaInfo {
  return {
    rol,
    label,
    nombres: entidad.nombres,
    cedula: entidad.cedula,
    telefono: entidad.telefono,
    organizacion: entidad.organizacion,
    asignado: true,
  };
}

function personaSinAsignar(rol: string, label: string): PersonaInfo {
  return {
    rol,
    label,
    nombres: "No registrado",
    cedula: "",
    telefono: "",
    asignado: false,
  };
}

function acreditadoCdaDe(
  acreditadosCda: AcreditadoCda[],
  recintoCodigo: number,
): AcreditadoCda | null {
  return (
    acreditadosCda.find(
      (a) => a.recintoCodigo === recintoCodigo && a.tipo === "titular",
    ) ?? null
  );
}

export default function Panel({
  data,
  lideres,
  coordinadores,
  veedores,
  acreditadosCda,
  rol,
}: Props) {
  const puedeVerCobertura = rol !== "invitado";
  const v = view.value;
  const [personas, setPersonas] = useState<PersonaInfo[] | null>(null);
  useEffect(() => {
    setPersonas(null);
  }, [v]);
  const parByCode = useMemo(() => buildParByCode(data), [data]);
  const stats = useMemo(() => buildParroquiaStats(data), [data]);
  const totales = useMemo(() => buildTotales(data), [data]);
  const coberturaParroquia = useMemo(
    () =>
      calcularCoberturaPorParroquia(
        data.parroquias.features,
        data.recintos,
        veedores,
        coordinadores,
        acreditadosCda,
      ),
    [data, veedores, coordinadores, acreditadosCda],
  );
  const coberturaRecinto = useMemo(() => {
    const porRecinto = new Map<number, CoberturaRecinto>();
    for (const c of calcularCobertura(
      data.recintos,
      veedores,
      coordinadores,
      acreditadosCda,
    )) {
      porRecinto.set(c.recintoCodigo, c);
    }
    return porRecinto;
  }, [data, veedores, coordinadores, acreditadosCda]);

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
        {puedeVerCobertura ? (
          <GroupSummary
            features={byType(true)}
            stats={stats}
            cobertura={coberturaParroquia}
          />
        ) : null}
        <ul class="list">
          {byType(true).map((f) => (
            <ParroquiaRow
              key={f.properties.code}
              f={f}
              stats={stats[f.properties.code]}
              cobertura={coberturaParroquia[f.properties.code]}
              puedeVerCobertura={puedeVerCobertura}
            />
          ))}
        </ul>
        <h3>Parroquias rurales</h3>
        {puedeVerCobertura ? (
          <GroupSummary
            features={byType(false)}
            stats={stats}
            cobertura={coberturaParroquia}
          />
        ) : null}
        <ul class="list">
          {byType(false).map((f) => (
            <ParroquiaRow
              key={f.properties.code}
              f={f}
              stats={stats[f.properties.code]}
              cobertura={coberturaParroquia[f.properties.code]}
              puedeVerCobertura={puedeVerCobertura}
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
        {puedeVerCobertura ? (
          <CoberturaBarsAgregado cobertura={coberturaParroquia[v.code]} />
        ) : null}
        <h3>Recintos</h3>
        <ul class="list">
          {recs.map((r) => (
            <RecintoRow
              key={r.cod}
              r={r}
              showParish={false}
              parByCode={parByCode}
              cobertura={coberturaRecinto.get(r.cod)}
              puedeVerCobertura={puedeVerCobertura}
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
    const lideresRecinto = responsablesDeRecinto(lideres, r);
    const coordinadorRecinto = coordinadorDe(coordinadores, r.cod);
    const acreditadoCdaRecinto = r.cda
      ? acreditadoCdaDe(acreditadosCda, r.cod)
      : null;
    const contactos: PersonaInfo[] = [
      ...(lideresRecinto.length > 0
        ? lideresRecinto.map((l) => personaDe("Líder", l))
        : [personaSinAsignar("Líder", "Líder")]),
      coordinadorRecinto
        ? personaDe("Coordinador de recinto", coordinadorRecinto, "Coordinador")
        : personaSinAsignar("Coordinador de recinto", "Coordinador"),
      ...(r.cda
        ? [
            acreditadoCdaRecinto
              ? personaDe("Acreditado CDA", acreditadoCdaRecinto, "CDA")
              : personaSinAsignar("Acreditado CDA", "CDA"),
          ]
        : []),
    ];
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
        {puedeVerCobertura ? (
          <EstadoRecinto cobertura={coberturaRecinto.get(r.cod)} cda={r.cda} />
        ) : null}
        <dl>
          <dt>Electores</dt>
          <dd>{fmt(r.el)}</dd>
          <dt>Total de juntas</dt>
          <dd>{r.jt}</dd>
          <dt>Parroquia</dt>
          <dd>{f.properties.name}</dd>
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
        {puedeVerCobertura ? (
          <button class="go go-btn" onClick={() => setPersonas(contactos)}>
            Líderes
          </button>
        ) : null}
        {personas ? (
          <PersonaModal personas={personas} onClose={() => setPersonas(null)} />
        ) : null}
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
            <RecintoRow
              key={r.cod}
              r={r}
              showParish
              parByCode={parByCode}
              cobertura={coberturaRecinto.get(r.cod)}
              puedeVerCobertura={puedeVerCobertura}
            />
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
  cobertura,
  puedeVerCobertura,
}: {
  f: ParroquiaFeature;
  stats: ParroquiaStats;
  cobertura: CoberturaParroquia | undefined;
  puedeVerCobertura: boolean;
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
      {puedeVerCobertura ? <ResumenCompacto cobertura={cobertura} /> : null}
    </li>
  );
}

function RecintoRow({
  r,
  showParish,
  parByCode,
  cobertura,
  puedeVerCobertura,
}: {
  r: Recinto;
  showParish: boolean;
  parByCode: Map<number, ParroquiaFeature>;
  cobertura: CoberturaRecinto | undefined;
  puedeVerCobertura: boolean;
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
      {puedeVerCobertura ? (
        <EstadoRecinto cobertura={cobertura} cda={r.cda} compact />
      ) : null}
    </li>
  );
}

function pctOf(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

function colorForPct(pctValue: number): string {
  const hue = Math.round((pctValue / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

// Versión de una sola línea para la vista general (cantón): las barras
// completas por parroquia ocupaban demasiado espacio en una lista de 15+
// filas. El punto de color refleja el % registrado, y el texto muestra
// "registrado% - verificado%" (mismo formato que las barras completas del
// detalle de parroquia) para no perder esa distinción.
function ResumenCompacto({
  cobertura,
}: {
  cobertura: CoberturaParroquia | undefined;
}) {
  const pctVeedores = cobertura?.pctVeedores ?? 0;
  const pctVeedoresVerificado = cobertura?.pctVeedoresVerificado ?? 0;
  const pctCoordinador = cobertura?.pctCoordinador ?? 0;
  const pctCoordinadorVerificado = cobertura?.pctCoordinadorVerificado ?? 0;
  const mostrarCda = (cobertura?.totalRecintosCda ?? 0) > 0;
  return (
    <div class="resumen-compacto">
      <span class="resumen-item">
        <span
          class="resumen-dot"
          style={{ background: colorForPct(pctVeedores) }}
        />
        Veedores {pctVeedores}% - {pctVeedoresVerificado}%
      </span>
      <span class="resumen-item">
        <span
          class="resumen-dot"
          style={{ background: colorForPct(pctCoordinador) }}
        />
        Coordinador {pctCoordinador}% - {pctCoordinadorVerificado}%
      </span>
      {mostrarCda ? (
        <span class="resumen-item">
          <span
            class="resumen-dot"
            style={{ background: colorForPct(cobertura!.pctCda) }}
          />
          CDA {cobertura!.pctCda}% - {cobertura!.pctCdaVerificado}%
        </span>
      ) : null}
    </div>
  );
}

function GroupSummary({
  features,
  stats,
  cobertura,
}: {
  features: ParroquiaFeature[];
  stats: Record<number, ParroquiaStats>;
  cobertura: Record<number, CoberturaParroquia>;
}) {
  if (features.length === 0) return null;
  const totalEl = features.reduce(
    (a, f) => a + stats[f.properties.code].el,
    0,
  );
  const totalJt = features.reduce(
    (a, f) => a + stats[f.properties.code].jt,
    0,
  );
  const avg = (key: keyof CoberturaParroquia) =>
    Math.round(
      features.reduce(
        (a, f) => a + ((cobertura[f.properties.code]?.[key] as number) ?? 0),
        0,
      ) / features.length,
    );
  // El CDA solo aplica a un puñado de recintos: promediar el % por
  // parroquia diluiría el resultado con las que no tienen ninguno. En vez
  // de eso, sumamos los conteos reales de todo el grupo y sacamos la
  // proporción sobre ese total.
  const sum = (key: keyof CoberturaParroquia) =>
    features.reduce(
      (a, f) => a + ((cobertura[f.properties.code]?.[key] as number) ?? 0),
      0,
    );
  const totalRecintosCda = sum("totalRecintosCda");
  const coberturaGrupo: CoberturaParroquia = {
    parroquiaCodigo: 0,
    totalJuntas: 0,
    juntasConVeedor: 0,
    juntasConVeedorVerificado: 0,
    pctVeedores: avg("pctVeedores"),
    pctVeedoresVerificado: avg("pctVeedoresVerificado"),
    totalRecintos: 0,
    recintosConCoordinador: 0,
    recintosConCoordinadorVerificado: 0,
    pctCoordinador: avg("pctCoordinador"),
    pctCoordinadorVerificado: avg("pctCoordinadorVerificado"),
    totalRecintosCda,
    recintosConCda: sum("recintosConCda"),
    recintosConCdaVerificado: sum("recintosConCdaVerificado"),
    pctCda: pctOf(sum("recintosConCda"), totalRecintosCda),
    pctCdaVerificado: pctOf(sum("recintosConCdaVerificado"), totalRecintosCda),
  };
  return (
    <div class="group-summary">
      <div class="stats">
        <div class="stat">
          <b>{features.length}</b>
          <small>{features.length === 1 ? "parroquia" : "parroquias"}</small>
        </div>
        <div class="stat">
          <b>{fmt(totalEl)}</b>
          <small>electores</small>
        </div>
        <div class="stat">
          <b>{totalJt}</b>
          <small>juntas</small>
        </div>
      </div>
      <ResumenCompacto cobertura={coberturaGrupo} />
    </div>
  );
}

// Barras de progreso: para una agrupación de varios recintos (parroquia o
// cantón), veedores/coordinador/CDA son proporciones reales, así que tiene
// sentido mostrarlas como porcentaje.
function CoberturaBarsAgregado({
  cobertura,
}: {
  cobertura: CoberturaParroquia | undefined;
}) {
  return (
    <div class="progress-group">
      <ProgressBar
        label="Veedores"
        pct={cobertura?.pctVeedores ?? 0}
        pctVerificado={cobertura?.pctVeedoresVerificado ?? 0}
      />
      <ProgressBar
        label="Coordinador"
        pct={cobertura?.pctCoordinador ?? 0}
        pctVerificado={cobertura?.pctCoordinadorVerificado ?? 0}
      />
      {cobertura && cobertura.totalRecintosCda > 0 ? (
        <ProgressBar
          label="CDA"
          pct={cobertura.pctCda}
          pctVerificado={cobertura.pctCdaVerificado}
        />
      ) : null}
    </div>
  );
}

// Para un solo recinto, coordinador y CDA son binarios (una persona o
// ninguna): una barra de progreso ahí solo puede estar vacía o llena, así
// que se muestran como una etiqueta de estado en vez de una barra. Veedores
// sigue siendo una barra porque un recinto puede tener varias juntas.
function EstadoRecinto({
  cobertura,
  cda,
  compact,
}: {
  cobertura: CoberturaRecinto | undefined;
  cda: boolean;
  compact?: boolean;
}) {
  return (
    <div class={compact ? "progress-group compact" : "progress-group"}>
      <ProgressBar
        label="Veedores"
        pct={cobertura?.pctVeedores ?? 0}
        pctVerificado={cobertura?.pctVeedoresVerificado ?? 0}
      />
      <div class="chip-row">
        <EstadoChip
          label="Coordinador"
          tieneTitular={cobertura?.tieneCoordinadorTitular ?? false}
          verificado={cobertura?.tieneCoordinadorVerificado ?? false}
        />
        {cda ? (
          <EstadoChip
            label="CDA"
            tieneTitular={cobertura?.tieneCdaTitular ?? false}
            verificado={cobertura?.tieneCdaVerificado ?? false}
          />
        ) : null}
      </div>
    </div>
  );
}

function EstadoChip({
  label,
  tieneTitular,
  verificado,
}: {
  label: string;
  tieneTitular: boolean;
  verificado: boolean;
}) {
  const estado = !tieneTitular ? "sin" : verificado ? "ok" : "pendiente";
  const texto = !tieneTitular
    ? "Sin asignar"
    : verificado
      ? "Verificado"
      : "Asignado";
  return (
    <span class={`chip-estado chip-estado-${estado}`}>
      {label}: {texto}
    </span>
  );
}

// Barra de dos colores: la porción verde (a la izquierda) es el % ya
// verificado y la porción roja el % registrado que aún falta contactar,
// ambas sobre el mismo total. El resto de la barra (sin colorear) es lo que
// aún no tiene titular asignado.
function ProgressBar({
  label,
  pct,
  pctVerificado,
}: {
  label: string;
  pct: number;
  pctVerificado: number;
}) {
  const pendiente = Math.max(0, pct - pctVerificado);
  return (
    <div class="progress">
      <div class="progress-head">
        <span>{label}</span>
        <span>
          {pct}% - {pctVerificado}%
        </span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill progress-fill-ok"
          style={{ width: `${pctVerificado}%` }}
        />
        <div
          class="progress-fill progress-fill-pending"
          style={{ left: `${pctVerificado}%`, width: `${pendiente}%` }}
        />
      </div>
    </div>
  );
}

// Convierte un teléfono ecuatoriano (celular con 0 inicial, o ya con
// código de país) al formato internacional sin signos que espera wa.me.
function numeroWhatsapp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("593")) return digitos;
  if (digitos.startsWith("0")) return `593${digitos.slice(1)}`;
  return digitos;
}

function PersonaModal({
  personas,
  onClose,
}: {
  personas: PersonaInfo[];
  onClose: () => void;
}) {
  const [activo, setActivo] = useState(0);
  const persona = personas[activo] ?? personas[0];
  const telefono = persona.telefono.trim();
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal-card" onClick={(e) => e.stopPropagation()}>
        <button class="modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
        {personas.length > 1 ? (
          <div class="modal-tabs">
            {personas.map((p, i) => (
              <button
                key={i}
                class={
                  i === activo ? "modal-tab modal-tab-active" : "modal-tab"
                }
                onClick={() => setActivo(i)}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
        <p class="modal-rol">{persona.rol}</p>
        {persona.asignado ? (
          <>
            <h3 class="modal-nombre">{persona.nombres}</h3>
            <dl class="modal-dl">
              <dt>Cédula</dt>
              <dd>{persona.cedula || "No registrada"}</dd>
              <dt>Teléfono</dt>
              <dd>{telefono || "No registrado"}</dd>
              {persona.organizacion ? (
                <>
                  <dt>Organización</dt>
                  <dd>{persona.organizacion}</dd>
                </>
              ) : null}
            </dl>
            {telefono ? (
              <div class="modal-actions">
                <a class="modal-btn modal-btn-call" href={`tel:${telefono}`}>
                  Llamar
                </a>
                <a
                  class="modal-btn modal-btn-whatsapp"
                  href={`https://wa.me/${numeroWhatsapp(telefono)}`}
                  target="_blank"
                  rel="noopener"
                >
                  WhatsApp
                </a>
              </div>
            ) : (
              <p class="modal-sin-telefono">Sin teléfono registrado.</p>
            )}
          </>
        ) : (
          <p class="modal-no-registrado">No registrado.</p>
        )}
      </div>
    </div>
  );
}
