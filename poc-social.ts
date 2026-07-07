import ytdl from 'youtube-dl-exec';

const urls = [
  { platform: 'YouTube', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }, // Me at the zoo
  { platform: 'TikTok', url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675' },
  { platform: 'Instagram', url: 'https://www.instagram.com/reel/C2-1x5yO5tZ/' } // Generic public reel
];

async function runPOC() {
  console.log('🚀 Iniciando Prueba de Concepto (POC) de Ingestión de Redes Sociales\n');

  for (const item of urls) {
    console.log(`----------------------------------------`);
    console.log(`Testing ${item.platform} -> ${item.url}`);
    try {
      // Pedimos a yt-dlp que solo nos devuelva los metadatos (dump-json) sin descargar el video pesado aun
      const output = await (ytdl as any)(item.url, {
        dumpJson: true,
        noWarnings: true,
        noCallHome: true,
        noCheckCertificate: true,
      });

      // output es un JSON gigante. Extraemos lo que nos sirve para la Wiki:
      console.log('✅ EXTRACCIÓN EXITOSA:');
      console.log(`- Título: ${output.title}`);
      console.log(`- Descripción (recortada): ${output.description ? output.description.substring(0, 50) : 'N/A'}...`);
      console.log(`- Duración: ${output.duration} segundos`);
      
      // Chequear si yt-dlp encontró subtítulos automáticos (ideal para YouTube)
      const hasAutoSubs = output.automatic_captions ? Object.keys(output.automatic_captions).length > 0 : false;
      console.log(`- ¿Tiene Subtítulos Automáticos?: ${hasAutoSubs ? 'SÍ' : 'NO'}`);

      // Comprobar la url directa del media
      console.log(`- URL directa del archivo: ${output.url ? 'SÍ (Extraída)' : 'NO'}`);
      
    } catch (err: any) {
      console.log(`❌ ERROR EXTRAYENDO ${item.platform}:`);
      // Mostrar la razón del fallo completa
      console.error(err.message); 
    }
    console.log(`----------------------------------------\n`);
  }
}

runPOC().catch(console.error);
