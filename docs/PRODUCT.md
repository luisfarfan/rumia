# PRODUCT — Rumia

register: product

## Qué es

Una base de conocimiento personal. Mandas un enlace, una foto o una nota de voz
por Telegram; el pipeline lo transcribe, lo lee, lo redacta como entrada de
wiki, verifica sus afirmaciones y conecta sus entidades. El dashboard es la
vista principal de todo eso.

## Quién lo usa

Una sola persona: la que capturó el material. No hay cuentas, ni equipos, ni
onboarding. Eso cambia el diseño de raíz:

- No hace falta explicar qué es un ítem: quien mira ya lo mandó.
- Sí hace falta explicar **qué le pasó** a ese ítem. La ingesta es asíncrona, de
  cuatro fases y falla de formas parciales.
- La sesión típica no es "gestionar", es **releer**. Entradas de miles de
  caracteres, transcripciones literales, verificaciones con fuentes.

## La escena

Alguien revisa por la tarde, en un portátil, lo que consumió durante el día.
Lee párrafos largos y compara lo que la fuente dijo con lo que el modelo
escribió. Es una actividad de lectura, no de monitorización — por eso el fondo
por defecto es papel y no un panel oscuro de telemetría. El modo noche existe y
está diseñado, pero es la segunda lectura de la misma superficie, no la primera.

## Principios

1. **Un ítem degradado nunca se ve igual que uno completo.** El pipeline marca
   lo que llegó incompleto y con qué motivo; la interfaz tiene que enseñarlo,
   nunca tragárselo. Es la regla que gobierna todo lo demás.
2. **Las palabras de la fuente y las del modelo no se mezclan.** La entrada
   redactada y la transcripción literal viven en pestañas hermanas, en el mismo
   sitio de la pantalla, para poder saltar entre ambas.
3. **El estado interno se traduce.** `chunked_and_embedded` no es una respuesta.
   Cuatro fases con nombre y un recorrido visible, sí.
4. **Español.** El producto, el bot y el README están en español; la interfaz
   también. Lo único que se queda en su idioma es el contenido de la fuente,
   que se preserva a propósito.
5. **Todo lo visual se ve.** El contenido social es imagen primero; una miniatura
   de 20 píxeles al lado de un párrafo lo traiciona.

## Anti-referencias

- El panel de observabilidad oscuro con acento índigo y tarjetas de cristal.
  Es el primer reflejo de cualquier "herramienta de conocimiento con IA" y no
  tiene nada que ver con leer.
- El grid de tarjetas idénticas. El contenido aquí es desigual por naturaleza
  — un stub de 37 caracteres junto a una página de 25 000 — y meterlo en cajas
  del mismo tamaño miente sobre lo que hay dentro.
- El dashboard de métricas. Aquí no hay KPIs; hay cosas para leer.

## Tono

Directo y en segunda persona cuando hace falta ("Manda un enlace al bot y
aparecerá aquí"). Los estados vacíos enseñan qué llenaría ese hueco. Los errores
dicen qué falló y qué se hizo en su lugar, nunca solo "algo salió mal".
