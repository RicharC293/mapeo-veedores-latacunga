export interface ParroquiaProps {
  code: number;
  name: string;
  urbana: boolean;
  lx: number;
  ly: number;
}

export interface ParroquiaFeature {
  type: "Feature";
  properties: ParroquiaProps;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface ParroquiasCollection {
  type: "FeatureCollection";
  features: ParroquiaFeature[];
}

export interface BaseFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface Recinto {
  cod: number;
  par: number;
  nombre: string;
  dir: string;
  tel: string;
  cda: boolean;
  jf: number;
  jm: number;
  jt: number;
  fi: number;
  ff: number;
  mi: number;
  mf: number;
  el: number;
  lon: number;
  lat: number;
  dif: boolean;
  sinc: boolean;
  zona: string;
}

export interface ParroquiaStats {
  rec: number;
  el: number;
  jt: number;
  jf: number;
  jm: number;
}

export interface Totales {
  el: number;
  jt: number;
  jf: number;
  jm: number;
}

export interface MapData {
  parroquias: ParroquiasCollection;
  base: BaseFeature;
  recintos: Recinto[];
  corte: string | null;
}
