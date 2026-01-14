import { ScraperScheduler } from './scheduler.js';

/**
 * Script para executar o scheduler automático
 *
 * Uso:
 * - Para agendar execução diária às 9h: npm run scheduler
 * - Para executar imediatamente: npm run scheduler:now
 * - Para executar sem IA (manual): npm run scheduler:manual
 */

const args = process.argv.slice(2);
const mode = args[0] || 'schedule'; // 'schedule' | 'now' | 'manual'

const scheduler = new ScraperScheduler({
  cronExpression: process.env.CRON_SCHEDULE || '0 9 * * *', // 9h todos os dias
  headless: process.env.HEADLESS !== 'false', // true por default
  tryAI: process.env.USE_AI !== 'false', // true por default
  maxResults: process.env.MAX_RESULTS ? parseInt(process.env.MAX_RESULTS) : undefined,
  resultsFolder: process.env.RESULTS_FOLDER || './results',
});

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         SCHEDULER - DIÁRIO DA REPÚBLICA SCRAPER                ║
║                                                                ║
║  Recolha automática de anúncios públicos de seguros           ║
╚════════════════════════════════════════════════════════════════╝
  `);

  switch (mode) {
    case 'now':
      console.log('🚀 Executando imediatamente (com tentativa de IA)...\n');
      await scheduler.runNow(false);
      process.exit(0);
      break;

    case 'manual':
      console.log('🔧 Executando imediatamente (modo manual, sem IA)...\n');
      await scheduler.runNow(true);
      process.exit(0);
      break;

    case 'schedule':
    default:
      console.log('📅 Iniciando modo agendado...\n');
      scheduler.start();
      break;
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
