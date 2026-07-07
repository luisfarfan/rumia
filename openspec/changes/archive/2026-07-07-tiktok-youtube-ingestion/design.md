## Context

El sistema actual usa `webExtractionHandler` para procesar URLs entrantes en `BullMQ`, pero falla al intentar procesar YouTube y TikTok. Un enfoque puramente basado en audio es insuficiente, ya que las redes sociales cortas (TikTok/Shorts) dependen fuertemente del contexto visual (texto en pantalla, memes).
Se requiere una arquitectura **Agéntica Multimodal (LangGraph)** que no solo descargue el video, sino que extraiga conocimiento de su audio y sus fotogramas visuales de manera segura y escalable.

## Goals / Non-Goals

**Goals:**
- Implementar un flujo LangGraph (`ingestionAgent`) para procesar URLs complejas.
- Extraer metadatos, audio y fotogramas (frames) usando `yt-dlp` y `ffmpeg`.
- Usar Modelos de Visión (`gpt-image-2`, etc.) a través de `CLIProxyAPI` para "ver" los fotogramas del video.
- Sintetizar la transcripción y el contexto visual usando Modelos de Razonamiento (`claude-sonnet-5`).
- Parsear subtítulos `.vtt` de YouTube a texto plano (Fast-Path).
- Garantizar seguridad (URL sanitization), rendimiento (Stream de archivos) y limpieza de disco.

**Non-Goals:**
- No soportaremos Instagram o Facebook en esta fase por los altos bloqueos de Meta sin cookies.
- No dividiremos (chunking) audios > 25MB en esta iteración.

## Decisions

1. **Arquitectura Agéntica (LangGraph)**
   - *Por qué:* Un video de TikTok sin contexto visual no sirve. El grafo orquestará la descarga, la transcripción del audio y el análisis visual de los fotogramas clave simultáneamente, fusionándolos al final para generar el artefacto de conocimiento.

2. **Streams sobre Buffers (OOM Prevention)**
   - *Por qué:* Cargar un archivo de audio de 24MB en la memoria RAM de NodeJS para enviarlo a Whisper bloqueará el Event Loop o causará OOM. Usaremos `fs.createReadStream` para todas las transferencias de red y borraremos los archivos en un bloque `finally`.

3. **Parseo de VTT (Fast-Path YouTube)**
   - *Por qué:* Los subtítulos automáticos de YouTube ahorran tokens, pero vienen en `.vtt` con marcas de tiempo (00:01.000). Necesitamos una utilidad RegExp para limpiar estas marcas antes de pasarlo al LLM.

## Risks / Trade-offs

- **[Risk] Command Injection en `yt-dlp`:**
  - *Mitigación:* Se aplicará un validador Regex estricto (`^https://(www\.)?(youtube\.com|youtu\.be|tiktok\.com)/[a-zA-Z0-9_-]+`) antes de pasar la URL a `youtube-dl-exec`.
- **[Risk] Bloqueo de IP (Rate Limiting):** TikTok/YouTube banearán la IP si BullMQ ejecuta 100 trabajos en un segundo.
  - *Mitigación:* Se configurará un `limiter` estricto en la cola de BullMQ para procesos de redes sociales (ej. 5 trabajos por minuto) y Backoff Exponencial.
- **[Risk] Fuga de Espacio en Disco:** Archivos `.mp4` y `.mp3` residuales.
  - *Mitigación:* Todo archivo generado estará rastreado y se eliminará con `fs.unlink` en un bloque `finally` garantizado.
