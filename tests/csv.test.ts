import { describe, expect, it } from "vitest";
import { aCsv } from "../src/lib/gestion/csv";

describe("aCsv", () => {
  it("empieza con BOM y separa con punto y coma y CRLF", () => {
    const csv = aCsv(["a", "b"], [["x", "y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿a;b\r\nx;y\r\n");
  });

  it("entrecomilla lo que lleva separador, comillas o saltos de línea", () => {
    const csv = aCsv(["n"], [["a;b"], ['di "hola"'], ["l1\nl2"]]);
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"di ""hola"""');
    expect(csv).toContain('"l1\nl2"');
  });

  it("escribe los decimales con coma", () => {
    expect(aCsv(["p"], [[17.1], [100], [0]])).toBe(
      "﻿p\r\n17,1\r\n100\r\n0\r\n",
    );
  });

  it("conserva acentos y eñes", () => {
    expect(
      aCsv(["Parroquia"], [["Belisario Quevedo / Aláquez / Año"]]),
    ).toContain("Aláquez / Año");
  });
});
