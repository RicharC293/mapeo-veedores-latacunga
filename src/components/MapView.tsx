import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import { select, type Selection } from "d3-selection";
import { geoIdentity, geoPath, type GeoPath } from "d3-geo";
import {
  zoom as d3zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { scaleSqrt } from "d3-scale";
import { max } from "d3-array";
import "d3-transition";
import {
  selectCanton,
  selectParroquia,
  selectRecinto,
  view,
  zoomRequest,
} from "../lib/state";
import { buildParByCode, buildRecByCod, buildTotales } from "../lib/stats";
import { fmt, title } from "../lib/format";
import Legend from "./Legend";
import type { MapData, ParroquiaFeature, Recinto } from "../lib/types";

interface Props {
  data: MapData;
}

const TOP_DESKTOP = 110;
const TOP_MOBILE = 138;
const MOBILE_BREAKPOINT = 820;

function reducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface MapApi {
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  parByCode: Map<number, ParroquiaFeature>;
  recByCod: Map<number, Recinto>;
  highlight: (code: number | null, cod: number | null) => void;
  zoomTo: (feature: ParroquiaFeature) => void;
  zoomPoint: (r: Recinto) => void;
  scaleBy: (factor: number) => void;
  reset: () => void;
}

export default function MapView({ data }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const apiRef = useRef<MapApi | null>(null);
  const totales = useMemo(() => buildTotales(data), [data]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = document.getElementById("mapwrap");
    if (!svgEl || !wrap) return;

    const svg = select(svgEl);
    const root = svg.append("g");
    const gBase = root.append("path").attr("class", "base");
    const gPar = root.append("g");
    const gOut = root.append("g");
    const gLab = root.append("g");
    const gRec = root.append("g");

    let W = 0;
    let H = 0;
    let k = 1;
    const proj = geoIdentity().reflectY(true);
    const path: GeoPath = geoPath(proj as never);
    const rScale = scaleSqrt()
      .domain([0, max(data.recintos, (r) => r.el) ?? 0])
      .range([0, 11]);

    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .on("zoom", (e) => {
        k = e.transform.k;
        root.attr("transform", e.transform.toString());
        svg.classed("zoomed", k > 2.2);
        gRec
          .selectAll<SVGCircleElement, Recinto>("circle")
          .attr("r", (d) => Math.max(3.5, rScale(d.el)) * Math.pow(k, -0.85));
        gLab
          .selectAll<SVGTextElement, ParroquiaFeature>("text")
          .style(
            "font-size",
            (d) =>
              `${((d.properties.urbana ? 11 : 13) * (W < MOBILE_BREAKPOINT ? 0.82 : 1)) / k}px`,
          )
          .style("stroke-width", `${3 / k}px`);
      });

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    function layout(): void {
      W = wrap!.clientWidth;
      H = wrap!.clientHeight;
      svg.attr("viewBox", `0 0 ${W} ${H}`);
      const top = W < MOBILE_BREAKPOINT ? TOP_MOBILE : TOP_DESKTOP;
      const pad = 16;
      proj.fitExtent(
        [
          [pad, top],
          [W - pad, H - 60],
        ],
        data.parroquias as never,
      );
      gBase.attr("d", path(data.base as never));
      gPar
        .selectAll<SVGPathElement, ParroquiaFeature>("path")
        .attr("d", path as never);
      gOut
        .selectAll<SVGPathElement, ParroquiaFeature>("path")
        .attr("d", path as never);
      gLab
        .selectAll<SVGTextElement, ParroquiaFeature>("text")
        .attr("x", (d) => proj([d.properties.lx, d.properties.ly])![0])
        .attr("y", (d) => proj([d.properties.lx, d.properties.ly])![1]);
      gRec
        .selectAll<SVGCircleElement, Recinto>("circle")
        .attr("cx", (d) => proj([d.lon, d.lat])![0])
        .attr("cy", (d) => proj([d.lon, d.lat])![1]);
    }

    gPar
      .selectAll<SVGPathElement, ParroquiaFeature>("path")
      .data(data.parroquias.features)
      .join("path")
      .attr("class", (d) => "parish " + (d.properties.urbana ? "urb" : "rur"))
      .on("click", (e: Event, d) => {
        e.stopPropagation();
        selectParroquia(d.properties.code, true);
      })
      .append("title")
      .text((d) => d.properties.name);

    gLab
      .selectAll<SVGTextElement, ParroquiaFeature>("text")
      .data(data.parroquias.features)
      .join("text")
      .attr("class", (d) => "plabel" + (d.properties.urbana ? " u" : ""))
      .text((d) => d.properties.name.replace(/ \(.*\)/, ""));

    const sorted = [...data.recintos].sort((a, b) => b.el - a.el);
    gRec
      .selectAll<SVGCircleElement, Recinto>("circle")
      .data(sorted, (d) => d.cod)
      .join("circle")
      .attr("class", "rec")
      .on("click", (e: Event, d) => {
        e.stopPropagation();
        selectRecinto(d.cod, true);
      })
      .append("title")
      .text((d) => title(d.nombre));

    layout();
    zoomBehavior.transform(svg, zoomIdentity);

    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);

    const parByCode = buildParByCode(data);
    const recByCod = buildRecByCod(data);

    function transitionTo(t: ZoomTransform): void {
      svg
        .transition()
        .duration(reducedMotion() ? 0 : 650)
        .call(zoomBehavior.transform, t);
    }

    function zoomTo(feature: ParroquiaFeature): void {
      const [[x0, y0], [x1, y1]] = path.bounds(feature as never)!;
      const top = W < MOBILE_BREAKPOINT ? TOP_MOBILE : TOP_DESKTOP;
      const s = Math.min(
        40,
        0.85 / Math.max((x1 - x0) / W, (y1 - y0) / (H - top)),
      );
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      transitionTo(
        zoomIdentity
          .translate(W / 2, top + (H - top) / 2)
          .scale(s)
          .translate(-cx, -cy),
      );
    }

    function zoomPoint(r: Recinto): void {
      const [x, y] = proj([r.lon, r.lat])!;
      const s = Math.max(k, 14);
      const top = W < MOBILE_BREAKPOINT ? TOP_MOBILE : TOP_DESKTOP;
      transitionTo(
        zoomIdentity
          .translate(W / 2, top + (H - top) / 2)
          .scale(s)
          .translate(-x, -y),
      );
    }

    function highlight(code: number | null, cod: number | null): void {
      svg.classed("dimmed", code != null);
      gPar
        .selectAll<SVGPathElement, ParroquiaFeature>("path")
        .classed("on", (d) => d.properties.code === code);
      gRec
        .selectAll<SVGCircleElement, Recinto>("circle")
        .classed("inpar", (d) => d.par === code)
        .classed("on", (d) => d.cod === cod);
      const outlineFeature = code != null ? parByCode.get(code) : undefined;
      gOut
        .selectAll<SVGPathElement, ParroquiaFeature>("path")
        .data(outlineFeature ? [outlineFeature] : [])
        .join("path")
        .attr("class", "outline")
        .attr("d", path as never);
      if (cod != null) {
        gRec
          .selectAll<SVGCircleElement, Recinto>("circle")
          .filter((d) => d.cod === cod)
          .raise();
      }
    }

    apiRef.current = {
      svg,
      zoomBehavior,
      parByCode,
      recByCod,
      highlight,
      zoomTo,
      zoomPoint,
      scaleBy: (factor) =>
        svg
          .transition()
          .duration(reducedMotion() ? 0 : 300)
          .call(zoomBehavior.scaleBy, factor),
      reset: () => transitionTo(zoomIdentity),
    };
    apiRef.current.highlight(null, null);

    return () => {
      ro.disconnect();
      svg.selectAll("*").remove();
      apiRef.current = null;
    };
    // Se ejecuta una sola vez: los datos son estáticos durante la vida de la isla.
  }, []);

  useSignalEffect(() => {
    const v = view.value;
    const api = apiRef.current;
    if (!api) return;
    if (v.kind === "parroquia") {
      api.highlight(v.code, null);
    } else if (v.kind === "recinto") {
      const r = api.recByCod.get(v.cod);
      api.highlight(r ? r.par : null, v.cod);
    } else {
      api.highlight(null, null);
    }
  });

  useSignalEffect(() => {
    const req = zoomRequest.value;
    const api = apiRef.current;
    if (!req || !api) return;
    const { target } = req;
    if (target.kind === "canton") api.reset();
    else if (target.kind === "parroquia") {
      const f = api.parByCode.get(target.code);
      if (f) api.zoomTo(f);
    } else if (target.kind === "recinto") {
      const r = api.recByCod.get(target.cod);
      if (r) api.zoomPoint(r);
    }
  });

  return (
    <>
      <svg
        id="map"
        ref={svgRef}
        role="img"
        aria-label="Mapa de parroquias y recintos electorales del cantón Latacunga"
      />
      <div class="head">
        <h1>Recintos electorales de Latacunga</h1>
        <p id="resumen">
          {data.recintos.length} recintos en {data.parroquias.features.length}{" "}
          parroquias, {fmt(totales.el)} electores y {fmt(totales.jt)} juntas.
        </p>
      </div>
      <div class="ctrls">
        <button
          aria-label="Acercar"
          onClick={() => apiRef.current?.scaleBy(1.6)}
        >
          +
        </button>
        <button
          aria-label="Alejar"
          onClick={() => apiRef.current?.scaleBy(1 / 1.6)}
        >
          −
        </button>
        <button
          aria-label="Ver todo el cantón"
          onClick={() => selectCanton(true)}
        >
          ⤢
        </button>
      </div>
      <a class="gestion-link" href="/gestion">
        Gestión →
      </a>
      <Legend />
    </>
  );
}
