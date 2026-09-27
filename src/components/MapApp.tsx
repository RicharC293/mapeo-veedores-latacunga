import MapView from "./MapView";
import Panel from "./Panel";
import SearchBox from "./SearchBox";
import type { MapData } from "../lib/types";
import type { Coordinador, Lider, Veedor } from "../lib/gestion/types";

interface Props {
  data: MapData;
  lideres: Lider[];
  coordinadores: Coordinador[];
  veedores: Veedor[];
}

export default function MapApp({
  data,
  lideres,
  coordinadores,
  veedores,
}: Props) {
  return (
    <>
      <div class="mapwrap" id="mapwrap">
        <MapView data={data} />
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
          />
        </div>
      </aside>
    </>
  );
}
