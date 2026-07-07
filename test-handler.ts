import { socialMediaHandler } from './src/workers/ingestion/handlers/socialMediaHandler.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const url = 'https://www.tiktok.com/@photogragero/video/7651104308947143944?q=barranco%202025&t=1768933613629';
  console.log(`🚀 Iniciando prueba end-to-end con TikTok...`);
  console.log(`URL: ${url}\n`);

  try {
    const result = await socialMediaHandler(url, 'test-item-tiktok-01');
    console.log('\n✅ PRUEBA EXITOSA!');
    console.log('=============================================');
    console.log(`TÍTULO: ${result.title}`);
    console.log('=============================================');
    console.log('CONTENIDO SINTETIZADO POR EL AGENTE:');
    console.log(result.content);
    console.log('=============================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ FALLÓ LA PRUEBA:', error);
    process.exit(1);
  }
}

test();
