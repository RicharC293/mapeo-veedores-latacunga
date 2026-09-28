import MapView from "./MapView";
import Panel from "./Panel";
import SearchBox from "./SearchBox";
import type { MapData } from "../lib/types";
import type {
  AcreditadoCda,
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

export default function MapApp({
  data,
  lideres,
  coordinadores,
  veedores,
  acreditadosCda,
  rol,
}: Props) {
  return (
    <>
      <div class="mapwrap" id="mapwrap">
        <MapView data={data} rol={rol} />
      </div>
      <aside class="panel" aria-live="polite">
        <div class="pin-top">
          <SearchBox />
        </div>
        <div class="body">
          <Panel
            data={data}
            lideres={lideres}
            coordinadores={coordinadores}
            veedores={veedores}
            acreditadosCda={acreditadosCda}
            rol={rol}
          />
        </div>
      </aside>
    </>
  );
}
