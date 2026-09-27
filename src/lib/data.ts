import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { supabasePublishable } from "./supabase";
import type {
  BaseFeature,
  MapData,
  ParroquiasCollection,
  Recinto,
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = resolve(__dirname, "../../data/seed");

// Código de cantón usado en las migraciones y en get_mapa(canton).
const CANTON_LATACUNGA = 100;

let cachedSeed: MapData | null = null;

function readSeed(): MapData {
  const parroquias = JSON.parse(
    readFileSync(resolve(seedDir, "parroquias.geojson"), "utf8"),
  ) as ParroquiasCollection;
  const base = JSON.parse(
    readFileSync(resolve(seedDir, "base.geojson"), "utf8"),
  ) as BaseFeature;
  const recintos = JSON.parse(
    readFileSync(resolve(seedDir, "recintos.json"), "utf8"),
  ) as Recinto[];
  return { parroquias, base, recintos, corte: null };
}

// Si Supabase está configurado, lee el mapa desde get_mapa() (respeta RLS
// y cachea 5 min según pages/index.astro). Si no, o si la consulta falla,
// usa el respaldo local en data/seed para poder seguir desarrollando sin
// conexión.
export async function getMapData(): Promise<MapData> {
  if (supabasePublishable) {
    const { data, error } = await supabasePublishable.rpc("get_mapa", {
      canton: CANTON_LATACUNGA,
    });
    if (!error && data) return data as unknown as MapData;
    console.error(
      "No se pudo leer el mapa desde Supabase, usando el respaldo local:",
      error?.message,
    );
  }
  if (!cachedSeed) cachedSeed = readSeed();
  return cachedSeed;
}
