import { bot } from './client.js';
import { TelegramCaptureService } from './telegramCaptureService.js';
import { RagService } from '../services/ragService.js';
import { CapturedItemsRepo } from '../db/capturedItemsRepo.js';
import { runFactCheckerAgent } from '../agents/factCheckerAgent.js';

export { bot };

// Helper for sending HTML responses
async function replySuccess(ctx: any, item: any, provider: string) {
  await ctx.reply(
    `<b>✅ Contenido registrado</b>\n` +
    `ID: <code>${item.id}</code>\n` +
    `Proveedor: <b>${item.detectedSource || provider}</b>\n` +
    `Estado: <code>${item.status}</code>`,
    { parse_mode: 'HTML' }
  );
}

// 1. Listen for Text Messages (URLs, notes, etc.)
bot.on('message:text', async (ctx) => {
  try {
    const item = await TelegramCaptureService.capture({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text: ctx.message.text,
    });
    
    await replySuccess(ctx, item, 'Desconocido');
  } catch (error) {
    console.error('Error processing text message:', error);
    await ctx.reply('❌ Hubo un error al guardar tu contenido. Por favor intenta de nuevo.');
  }
});

// 2. Listen for Documents (PDFs, text files, etc.)
bot.on('message:document', async (ctx) => {
  try {
    const doc = ctx.message.document;
    const item = await TelegramCaptureService.capture({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text: ctx.message.caption,
      file: {
        fileId: doc.file_id,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
      },
    });

    await replySuccess(ctx, item, 'documento');
  } catch (error) {
    console.error('Error processing document message:', error);
    await ctx.reply('❌ Hubo un error al registrar el archivo. Por favor intenta de nuevo.');
  }
});

// 3. Listen for Photos (read with the vision tier, which also transcribes text)
bot.on('message:photo', async (ctx) => {
  try {
    // Telegram sends every rendition, smallest first; the last is the largest.
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    if (!photo) throw new Error('Photo message arrived without any rendition.');

    const item = await TelegramCaptureService.capture({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text: ctx.message.caption,
      file: {
        fileId: photo.file_id,
        mimeType: 'image/jpeg',
        fileSize: photo.file_size,
      },
      detectedSource: 'photo',
    });

    await replySuccess(ctx, item, 'imagen');
  } catch (error) {
    console.error('Error processing photo message:', error);
    await ctx.reply('❌ Hubo un error al registrar la imagen.');
  }
});

// 4. Listen for Audio Messages
bot.on('message:audio', async (ctx) => {
  try {
    const audio = ctx.message.audio;
    const item = await TelegramCaptureService.capture({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text: ctx.message.caption,
      file: {
        fileId: audio.file_id,
        fileName: audio.file_name,
        mimeType: audio.mime_type,
        fileSize: audio.file_size,
      },
      detectedSource: 'audio',
    });

    await replySuccess(ctx, item, 'audio');
  } catch (error) {
    console.error('Error processing audio message:', error);
    await ctx.reply('❌ Hubo un error al registrar el audio.');
  }
});

// 4. Listen for Voice Notes
bot.on('message:voice', async (ctx) => {
  try {
    const voice = ctx.message.voice;
    const item = await TelegramCaptureService.capture({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      file: {
        fileId: voice.file_id,
        mimeType: voice.mime_type,
        fileSize: voice.file_size,
      },
      detectedSource: 'voice',
    });

    await replySuccess(ctx, item, 'voz');
  } catch (error) {
    console.error('Error processing voice message:', error);
    await ctx.reply('❌ Hubo un error al registrar la nota de voz.');
  }
});

// 5. Ask Command for querying the knowledge base (RAG)
bot.command('ask', async (ctx) => {
  const queryText = ctx.match;
  if (!queryText || queryText.trim() === '') {
    return await ctx.reply(
      'Por favor haz una pregunta después del comando.\n' +
      'Ejemplo: <code>/ask ¿Qué es LangGraph?</code>',
      { parse_mode: 'HTML' }
    );
  }

  try {
    // Show typing status indicator
    await ctx.replyWithChatAction('typing');

    // Call hybrid RAG service
    const result = await RagService.answerQuery(queryText, ctx.chat.id.toString());

    // Format response
    let responseText = result.answer;

    // Append source citations if available
    if (result.sources.length > 0) {
      responseText += '\n\n<b>Fuentes consultadas:</b>';
      result.sources.forEach((src) => {
        if (src.url) {
          responseText += `\n• <a href="${src.url}">${src.title || 'Enlace'}</a>`;
        }
      });
    }

    await ctx.reply(responseText, { 
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  } catch (error) {
    console.error('Error handling /ask command:', error);
    await ctx.reply('❌ Ocurrió un error al procesar tu pregunta. Por favor intenta de nuevo.');
  }
});

// 6. Verify Command for running the fact-checking agent manually
bot.command('verify', async (ctx) => {
  const itemId = ctx.match;
  if (!itemId || itemId.trim() === '') {
    return await ctx.reply(
      'Por favor ingresa el ID del contenido a verificar después del comando.\n' +
      'Ejemplo: <code>/verify UUID-DE-ITEM</code>',
      { parse_mode: 'HTML' }
    );
  }

  try {
    // Show typing status indicator
    await ctx.replyWithChatAction('typing');

    // Retrieve item from DB
    const item = await CapturedItemsRepo.findById(itemId);
    if (!item) {
      return await ctx.reply('❌ No se encontró ningún contenido con ese ID en la base de datos.');
    }

    const content = item.content || item.rawInput;
    if (!content || content.trim() === '') {
      return await ctx.reply('❌ El elemento seleccionado no tiene contenido de texto para verificar.');
    }

    await ctx.reply(`🔍 <b>Iniciando verificación web para el elemento:</b> <code>${item.id}</code>...`, { parse_mode: 'HTML' });

    // Run the fact-checking agent
    const reports = await runFactCheckerAgent(item.id, content);

    if (!reports || reports.length === 0) {
      return await ctx.reply('ℹ️ El agente no extrajo afirmaciones fácticas verificables del texto.');
    }

    // Format and reply with results
    let replyText = `📊 <b>Resultados de Verificación (Fact-checking):</b>\n\n`;
    
    reports.forEach((report: any, index: number) => {
      const statusIcon = report.status === 'True' ? '✅' : report.status === 'False' ? '❌' : '⚠️';
      const verdictName = report.status === 'True' ? 'VERDADERO' : report.status === 'False' ? 'FALSO' : 'INCONCLUSO';
      
      replyText += `${index + 1}. <b>Afirmación:</b> "${report.claim}"\n`;
      replyText += `<b>Veredicto:</b> ${statusIcon} <b>${verdictName}</b>\n`;
      replyText += `<b>Explicación:</b> ${report.explanation}\n`;
      
      if (report.sources && report.sources.length > 0) {
        replyText += `<b>Fuentes:</b>\n`;
        report.sources.forEach((src: any) => {
          replyText += `• <a href="${src.url}">${src.title}</a>\n`;
        });
      }
      replyText += `\n`;
    });

    await ctx.reply(replyText, { 
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  } catch (error) {
    console.error('Error handling /verify command:', error);
    await ctx.reply('❌ Ocurrió un error al ejecutar la verificación. Por favor intenta de nuevo.');
  }
});

// Start bot if run directly
bot.start().then(() => {
  console.log('Telegram Capture Bot is running...');
}).catch((err) => {
  console.error('Failed to start Telegram Bot:', err);
});
