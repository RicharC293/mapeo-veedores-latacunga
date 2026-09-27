// Carga data/seed/* a Supabase como el corte "2026-08-11" y lo marca activo.
// Requiere PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno
// (o en un archivo .env en la raíz del proyecto).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type {
  BaseFeature,
  ParroquiasCollection,
  Recinto,
} from "../src/lib/types";

try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: seguimos con las variables ya presentes en el entorno.
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const url = process.env.PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error(
    "Faltan PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno.",
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false },
});

const CANTON_LATACUNGA = 100;
const FECHA_CORTE = "2026-08-11";

async function main() {
  const parr = JSON.parse(
    readFileSync(resolve(root, "data/seed/parroquias.geojson"), "utf8"),
  ) as ParroquiasCollection;
  const base = JSON.parse(
    readFileSync(resolve(root, "data/seed/base.geojson"), "utf8"),
  ) as BaseFeature;
  const recintos = JSON.parse(
    readFileSync(resolve(root, "data/seed/recintos.json"), "utf8"),
  ) as Recinto[];

  console.log("Activando corte…");
  const { data: corteId, error: corteErr } = await supabase.rpc(
    "activar_corte",
    {
      p_fecha_corte: FECHA_CORTE,
      p_fuente: "CNE",
      p_archivo: "distributivo_latacunga.xlsx",
    },
  );
  if (corteErr) throw new Error(`activar_corte: ${corteErr.message}`);

  console.log(`Cargando ${parr.features.length} parroquias…`);
  for (const f of parr.features) {
    const { error } = await supabase.rpc("cargar_parroquia", {
      p_codigo: f.properties.code,
      p_canton_codigo: CANTON_LATACUNGA,
      p_nombre: f.properties.name,
      p_urbana: f.properties.urbana,
      p_geojson: JSON.stringify(f.geometry),
      p_lx: f.properties.lx,
      p_ly: f.properties.ly,
    });
    if (error)
      throw new Error(
        `cargar_parroquia ${f.properties.code}: ${error.message}`,
      );
  }

  console.log("Cargando la base del cantón…");
  const { error: baseErr } = await supabase.rpc("cargar_canton_base", {
    p_canton_codigo: CANTON_LATACUNGA,
    p_geojson: JSON.stringify(base.geometry),
  });
  if (baseErr) throw new Error(`cargar_canton_base: ${baseErr.message}`);

  console.log(`Cargando ${recintos.length} recintos…`);
  for (const r of recintos) {
    const { error } = await supabase.rpc("cargar_recinto", {
      p_codigo_cne: r.cod,
      p_corte_id: corteId,
      p_parroquia_codigo: r.par,
      p_nombre: r.nombre,
      p_direccion: r.dir,
      p_telefono: r.tel,
      p_zona: r.zona,
      p_cda: r.cda,
      p_jun_fem: r.jf,
      p_jun_mas: r.jm,
      p_total_juntas: r.jt,
      p_fem_ini: r.fi,
      p_fem_fin: r.ff,
      p_mas_ini: r.mi,
      p_mas_fin: r.mf,
      p_electores: r.el,
      p_dificil_acceso: r.dif,
      p_sin_conectividad: r.sinc,
      p_lon: r.lon,
      p_lat: r.lat,
    });
    if (error) throw new Error(`cargar_recinto ${r.cod}: ${error.message}`);
  }

  console.log("Verificando con get_mapa…");
  const { data: mapa, error: mapaErr } = await supabase.rpc("get_mapa", {
    canton: CANTON_LATACUNGA,
  });
  if (mapaErr) throw new Error(`get_mapa: ${mapaErr.message}`);

  const totalEl = mapa.recintos.reduce(
    (a: number, r: { el: number }) => a + r.el,
    0,
  );
  const totalJt = mapa.recintos.reduce(
    (a: number, r: { jt: number }) => a + r.jt,
    0,
  );
  console.log(
    `Listo: ${mapa.parroquias.features.length} parroquias, ${mapa.recintos.length} recintos, ` +
      `${totalEl.toLocaleString("es-EC")} electores, ${totalJt} juntas.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
