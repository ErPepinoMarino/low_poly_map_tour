export interface RoadExit {
  id: string;
  position: [number, number, number];
  label: {
    es: string;
    en: string;
  };
}

// Salidas de carretera que abandonan el encuadre del diorama.
// Las coordenadas se obtuvieron con el picker de desarrollo (?pickExits=1).
export const ROAD_EXITS: readonly RoadExit[] = [
  {
    id: 'playa',
    position: [991, 20.4, -120.2],
    label: { es: 'A la playa', en: 'To the beach' },
  },
  {
    id: 'castellon-n340',
    position: [888.3, 28.1, -565.4],
    label: { es: 'A Castellón - N340', en: 'To Castellón - N340' },
  },
  {
    id: 'castellon',
    position: [-489.8, 52.3, -1136.4],
    label: { es: 'A Castellón', en: 'To Castellón' },
  },
  {
    id: 'castellon-a7',
    position: [-851.6, 50.4, -926.5],
    label: { es: 'A Castellón - A7', en: 'To Castellón - A7' },
  },
  {
    id: 'valencia-a7',
    position: [-1022.2, 32.4, 463],
    label: { es: 'A Valencia - A7', en: 'To Valencia - A7' },
  },
  {
    id: 'valencia',
    position: [-525.8, 15.1, 862.8],
    label: { es: 'A Valencia', en: 'To Valencia' },
  },
  {
    id: 'valencia-n340',
    position: [-174.4, 14.4, 966.4],
    label: { es: 'A Valencia - N340', en: 'To Valencia - N340' },
  },
] as const;
