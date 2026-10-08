import type { APIRoute } from "astro";
import plantillaInline from "../../../../assets/plantillas/Matriz_Veedores_2027_JRV_CNE.xlsx?inline";
import { getMapData } from "../../../../lib/data";
import { listVeedores } from "../../../../lib/gestion/veedores";
import { listCoordinadores } from "../../../../lib/gestion/coordinadores";
import { listAcreditadosCda } from "../../../../lib/gestion/acreditadosCda";
import {
  fechaArchivo,
  opcionDescarga,
} from "../../../../lib/gestion/descargas";
import { armarCdaXlsx, llenarMatriz } from "../../../../lib/gestion/matrizXlsx";
import { json, requireApiRole } from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";

const TIPO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// La plantilla viaja dentro del servidor como data URL (?inline): así no
// depende de archivos sueltos en el despliegue.
function bytesDePlantilla(): Uint8Array {
  const base64 = plantillaInline.slice(plantillaInline.indexOf(",") + 1);
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export const GET: APIRoute = async ({ url, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.descargas);
  if (bloqueo) return bloqueo;
  const opcion = opcionDescarga(url.searchParams.get("tipo"));
  if (!opcion) {
    return json({ error: "Tipo de descarga no válido." }, { status: 400 });
  }
  try {
    const [mapa, veedores, coordinadores, acreditados] = await Promise.all([
      getMapData(),
      listVeedores(),
      listCoordinadores(),
      listAcreditadosCda(),
    ]);
    const datos = {
      recintos: mapa.recintos,
      parroquias: mapa.parroquias.features.map(({ properties }) => ({
        properties,
      })),
      veedores,
      coordinadores,
      acreditados,
    };
    const ahora = Date.now();
    const bytes =
      opcion.tipo === "cda"
        ? armarCdaXlsx(
            datos,
            new Intl.DateTimeFormat("es-EC", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "America/Guayaquil",
            }).format(new Date(ahora)),
          )
        : llenarMatriz(bytesDePlantilla(), datos, opcion.tipo).archivo;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": TIPO_XLSX,
        "content-disposition": `attachment; filename="${opcion.archivo}_${fechaArchivo(ahora)}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : "No se pudo generar el archivo.";
    return json({ error: mensaje }, { status: 500 });
  }
};
