import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recintoDePreferencia } from "../src/lib/gestion/recintoPreferencia";
import recintos from "../data/seed/recintos.json";
import type { ParroquiaFeature, Recinto } from "../src/lib/types";

const R = recintos as unknown as Recinto[];
const P = (
  JSON.parse(readFileSync("data/seed/parroquias.geojson", "utf8")) as {
    features: ParroquiaFeature[];
  }
).features;
const cod = (texto: string) => recintoDePreferencia(texto, R, P)?.cod ?? null;

describe("recintoDePreferencia", () => {
  it.each([
    ["Colegio La Salle", 1582],
    ["Unida Educativa La Salle", 1582],
    ["Unidad Educativa Jorge Icaza", 324],
    ["Luis Fernando Ruiz", 1576],
    ["Unidad Educativa Elvira Ortega", 1583],
    ["Escuela Simón Bolívar", 6334],
    ["Unidad Educativa José María Velasco Ibarra", 6322],
    ["Guaytacama", 1775],
    ["Unidad Educativa Primero de Abril", 6324],
    ["Unidad Educativa Ramón Barba Naranjo", 6332],
    ["Eloy Alfaro, San Felipe, Esuela Ana Páez", 354],
  ])("reconoce %s", (texto, esperado) => {
    expect(cod(texto)).toBe(esperado);
  });

  it.each([
    "Unida Educativa Vicente León",
    "Juan Montalvo - Junta 6",
    "Mulaló",
    "Latacunga",
    "San Buenaventura",
    "San Sebatián - Escuela",
    "",
    "Escuela",
  ])("no adivina cuando hay duda: %s", (texto) => {
    expect(cod(texto)).toBeNull();
  });
});
