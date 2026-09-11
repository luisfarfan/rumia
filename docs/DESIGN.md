# DESIGN — Rumia

Todos los tokens viven en [`frontend/src/app/globals.css`](../frontend/src/app/globals.css)
y se exponen como utilidades de Tailwind vía `@theme inline`. Este documento
explica **por qué** son los que son; el CSS es la fuente de la verdad.

## Color

Estrategia: **restrained**. Un solo acento, todo lo demás es tinta y regla.

El fondo es papel cálido, no blanco, y la tinta es casi negra cálida, nunca
`#000`. El modo noche es el mismo papel bajado de luz, mantenido en el tono 70
para que siga siendo cálido en vez del azul-negro de costumbre.

| Rol | Token | Para qué |
|---|---|---|
| Fondo | `--paper` | la superficie de lectura |
| Elevado | `--paper-raised` | cabecera, panel de lectura, inspector |
| Hundido | `--paper-sunken` | pozos, campos, el lienzo del grafo |
| Tinta | `--ink` / `--ink-muted` / `--ink-faint` | tres niveles, nunca más |
| Regla | `--rule` / `--rule-strong` | separadores y bordes |
| Acento | `--accent` | verde tinta |
| Aviso | `--warn` | ocre: llegó incompleto |
| Error | `--bad` | óxido: falló, o afirmación falsa |

El acento verde significa **una sola cosa**: afirmativo. Acción primaria,
selección, fase completada, afirmación verificada como cierta. No decora nada.

Ningún estado depende solo del color: cada píldora lleva también su palabra
(`Incompleto`, `No se pudo leer`, `Cierto`, `Falso`) y su glifo.

Los seis colores de entidad del grafo ([`lib/entities.ts`](../frontend/src/lib/entities.ts))
son una paleta risográfica, cada tono empujado hacia tinta de imprenta, con dos
afinados — uno por tema — porque el lienzo se pinta en JS y no puede leer
variables CSS.

## Tipografía

Tres familias, tres trabajos, ninguna decorativa:

- **Instrument Sans** — todo el cromo de la interfaz.
- **Newsreader** — las entradas, las transcripciones, las respuestas del RAG y
  las afirmaciones citadas. Son textos de miles de caracteres; una serif de
  lectura es lo correcto y además separa visualmente *contenido* de *interfaz*.
- **IBM Plex Mono** — lo escrito por la máquina: ids, etiquetas, estado interno,
  nombres de plataforma, cifras de recuento.

Escala fija en `rem`, razón ~1.2, de `--text-2xs` (11 px) a `--text-2xl`
(31 px). El diseño anterior tenía casi todo entre 9 y 12 px, sin jerarquía; el
cuerpo de lectura ahora es `--text-md` (17 px) con interlineado 1.72 y ancho
máximo 68ch.

## Forma y elevación

Radios pequeños (3–12 px): el registro es archivo, no burbuja. La sombra casi no
existe en claro; en oscuro la profundidad la dan las superficies y las reglas.
El fondo lleva una retícula de 32 px al 3 % de tinta, con máscara radial, para
que las zonas vacías se lean como superficie y no como vacío.

## Movimiento

150–280 ms, `cubic-bezier(0.22, 1, 0.36, 1)`. Solo comunica estado: entrada del
panel de lectura, aparición de una respuesta, cambio de selección, esqueletos de
carga. Nada coreografiado al cargar. `prefers-reduced-motion` lo apaga entero.

## Componentes

Las primitivas (`.btn`, `.field`, `.tag`, `.well`, `.panel`, `.u-label`,
`.u-prose`) están en `globals.css`, no repetidas como cadenas de utilidades en
cada componente: en el registro de producto la consistencia *es* la
affordance. Cada control interactivo tiene default, hover, focus, active y
disabled definidos.

Carga con esqueletos con la forma de la fila que reemplazan, nunca un spinner en
medio del contenido. Estados vacíos que enseñan qué llenaría el hueco.

## Estructura

```
frontend/src/
├─ app/          layout (fuentes, metadatos, arranque del tema), page (shell), globals.css
├─ components/
│  ├─ Header     marca, pestañas, indicador en vivo, tema
│  ├─ board/     BoardView · AskPanel · FilterBar · ItemRow · ItemReader · PipelineTrack · ClaimList
│  ├─ graph/     GraphView · GraphCanvas · GraphLegend · NodeInspector
│  └─ ui/        Mark · Skeleton · EmptyState · SourceIcon
├─ hooks/        useItems · useGraph · useAsk · useTranslator · useTheme · useHotkeys
└─ lib/          types · pipeline · format · sources · entities
```

`lib/pipeline.ts` es la pieza conceptual: traduce la columna `status` a cuatro
fases con nombre y estado, y es lo que dibujan tanto `PipelineTrack` (la barra
de cuatro segmentos de cada fila) como `PipelineDetail` (el recorrido del
lector).

## Reglas de la casa

- Ambas vistas se ocultan con `visibility`, nunca con `display: none`: el grafo
  es un lienzo que se auto-mide y sin caja que medir monta a tamaño cero.
- El tema lo manda el atributo `data-theme` del elemento raíz, estampado antes
  del primer pintado por un script en línea. Ningún componente copia el tema a
  estado propio.
- Nada de cristal esmerilado, texto con degradado, ni franjas de color al
  costado de las tarjetas.
