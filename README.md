# Mapeo de recintos electorales de Latacunga

Veeduría electoral de las Elecciones Seccionales y CPCCS 2027 en el cantón Latacunga, Cotopaxi, Ecuador.

Mapa interactivo de las 15 parroquias y 49 recintos electorales de Latacunga, con buscador y ficha por recinto, más un módulo de gestión de veedores, coordinadores, líderes y lista negra.

## Stack

- [Astro](https://astro.build) + [Preact](https://preactjs.com) (`@preact/signals` para estado compartido)
- [d3](https://d3js.org) (módulos `d3-geo`, `d3-zoom`, `d3-selection`, `d3-scale`, `d3-transition`, `d3-array`)
- [Supabase](https://supabase.com) (Postgres + PostGIS) como fuente de datos
- Desplegado en [Vercel](https://vercel.com)

## Desarrollo

```bash
pnpm install
cp .env.example .env   # completa con tus claves de Supabase (Settings > API Keys)
pnpm dev
```

Sin `.env` configurado, el sitio sigue funcionando con los datos semilla locales en `data/seed/`.

## Scripts

| Comando                  | Qué hace                                                    |
| ------------------------ | ----------------------------------------------------------- |
| `pnpm dev`               | Servidor de desarrollo en `localhost:4321`                  |
| `pnpm build`             | Build de producción                                         |
| `pnpm test`              | Pruebas con Vitest                                          |
| `pnpm lint`              | ESLint                                                      |
| `pnpm extract-reference` | Extrae los datos del prototipo HTML original a `data/seed/` |
| `pnpm seed-supabase`     | Carga `data/seed/*` a Supabase como corte activo            |

## Estructura

- `reference/`: prototipo HTML original (referencia visual y funcional, no se despliega).
- `data/seed/`: datos semilla extraídos del prototipo (parroquias, base del cantón, recintos).
- `data/db/`: respaldo local en JSON para veedores/coordinadores/líderes/lista negra cuando Supabase no está configurado.
- `supabase/migrations/`: esquema, funciones (`get_mapa`, altas/bajas con ascenso automático de suplentes) y políticas RLS.
- `src/pages/`: mapa público (`/`) y panel de gestión (`/gestion`).
- `src/lib/gestion/`: lógica de dominio de veedores, coordinadores, líderes y lista negra.

## Módulo de gestión

En `/gestion`: veedores (uno titular por junta receptora del voto + suplentes), coordinadores (uno titular por recinto + suplentes), líderes de parroquia y un líder general del cantón, lista negra, cobertura, crecimiento diario y organigrama. Sin autenticación por ahora.
