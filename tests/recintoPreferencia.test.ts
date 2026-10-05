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
    ["Semillas de Vida", 6461],
    ["Escuela 11 de Noviembre", 1575],
    ["Sindicato de Choferes", 6459],
    ["Colegio Vicente León La Cocha", 1605],
    ["Sufraga en la Jorge Icaza", 324],
    ["Sufraga en las escuela Semillitas de Vida", 6461],
    ["Parroquia Juan Montalvo Luis F Vivero", 2013],
    ["En la Cocha votan", 1605],
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
    "Parroquia La Matriz Victoria Vazcones Cuvi",
    "Recinto Palopo",
    "Sufraga en San Felipe",
    "La Matriz Centro",
    "U.E. Vicente León Centro",
    "U.E. Ana Paez",
    "CUALQUIER RECINTO",
    "",
    "Escuela",
  ])("no adivina cuando hay duda: %s", (texto) => {
    expect(cod(texto)).toBeNull();
  });
});
