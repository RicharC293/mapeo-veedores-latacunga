import type { APIRoute } from "astro";
import { getMapData } from "../../../lib/data";
import { agregarVeedor, listVeedores } from "../../../lib/gestion/veedores";
import { juntaId } from "../../../lib/gestion/juntas";
import { json, handle } from "../../../lib/gestion/apiHelpers";

export const GET: APIRoute = async () =>
  handle(async () => json(await listVeedores()));

export const POST: APIRoute = async ({ request }) =>
  handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      recintoCodigo: number;
      genero: "F" | "M";
      numero: number;
      tipo: "titular" | "suplente";
    };
    const data = await getMapData();
    const recinto = data.recintos.find((r) => r.cod === body.recintoCodigo);
    if (!recinto) throw new Error("Recinto no encontrado.");

    const id = juntaId(recinto.cod, body.genero, body.numero);
    const veedor = await agregarVeedor({
      cedula: body.cedula,
      nombres: body.nombres,
      telefono: body.telefono,
      juntaId: id,
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      tipo: body.tipo,
    });
    return json(veedor, { status: 201 });
  });
