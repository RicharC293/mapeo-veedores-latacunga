import MapView from "./MapView";
import Panel from "./Panel";
import SearchBox from "./SearchBox";
import type { MapData } from "../lib/types";

interface Props {
  data: MapData;
}

export default function MapApp({ data }: Props) {
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
          <Panel data={data} />
        </div>
      </aside>
    </>
  );
}
