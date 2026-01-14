import cron from 'node-cron';
import { DiarioRepublicaScraper } from './scrapper/diario-republica-scraper.js';
import { DiarioExcelGenerator } from './excel/excel-generator.js';
import { CPV_CODES } from './cpv.js';
import { sendScrapingEmail } from './email/email-sender.js';
import fs from 'fs';
import path from 'path';

interface SchedulerConfig {
  cronExpression: string; // '0 9 * * *' para todos os dias às 9h
  headless: boolean;
  tryAI: boolean;
  maxResults?: number;
  resultsFolder: string;
}

export class ScraperScheduler {
  private config: SchedulerConfig;
  private isRunning: boolean = false;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      cronExpression: config?.cronExpression || '0 9 * * *', // Default: 9h todos os dias
      headless: config?.headless ?? true,
      tryAI: config?.tryAI ?? true,
      maxResults: config?.maxResults,
      resultsFolder: config?.resultsFolder || './results',
      ...config,
    };

    // Criar pasta de resultados se não existir
    if (!fs.existsSync(this.config.resultsFolder)) {
      fs.mkdirSync(this.config.resultsFolder, { recursive: true });
    }
  }

  /**
   * Executar scraping manualmente (pode ser chamado a qualquer momento)
   */
  async runNow(forceManual: boolean = false): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Já existe uma execução em andamento. Aguarde...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    const logPrefix = `[${startTime.toISOString()}]`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${logPrefix} 🚀 INICIANDO EXECUÇÃO DE SCRAPING`);
    console.log(`${'='.repeat(60)}`);

    let useAI = this.config.tryAI && !forceManual;
    let success = false;
    let anuncios: any[] = [];
    let attemptMode = '';

    try {
      // ====== TENTATIVA 1: COM IA (se configurado) ======
      if (useAI) {
        console.log(`\n${logPrefix} 🤖 TENTATIVA 1: Executando com Agente de IA...`);
        attemptMode = 'IA';

        const scraperIA = new DiarioRepublicaScraper(); // Nova instância para IA
        try {
          scraperIA.loadCPVCodes(CPV_CODES);
          await scraperIA.init(this.config.headless, true);
          anuncios = await scraperIA.collectAnuncios(this.config.maxResults);

          if (anuncios.length > 0) {
            success = true;
            console.log(`${logPrefix} ✅ Sucesso com IA! ${anuncios.length} anúncios encontrados.`);
          } else {
            console.log(`${logPrefix} ⚠️ IA não encontrou anúncios. Tentando scraper manual...`);
            useAI = false;
          }
        } catch (error) {
          console.error(`${logPrefix} ❌ Falha na execução com IA:`, error);
          console.log(`${logPrefix} 🔄 Mudando para scraper manual...`);
          useAI = false;
        } finally {
          await scraperIA.close();
        }
      }

      // ====== TENTATIVA 2: SCRAPER MANUAL (fallback ou forçado) ======
      if (!success) {
        console.log(`\n${logPrefix} 🔧 TENTATIVA 2: Executando Scraper Manual (tradicional)...`);
        attemptMode = 'Manual';

        const scraperManual = new DiarioRepublicaScraper(); // Nova instância para Manual
        try {
          scraperManual.loadCPVCodes(CPV_CODES);
          await scraperManual.init(this.config.headless, false); // useAI = false
          anuncios = await scraperManual.collectAnuncios(this.config.maxResults);

          if (anuncios.length > 0) {
            success = true;
            console.log(`${logPrefix} ✅ Sucesso com scraper manual! ${anuncios.length} anúncios encontrados.`);
          } else {
            console.log(`${logPrefix} ⚠️ Nenhum anúncio encontrado mesmo com scraper manual.`);
          }
        } finally {
          await scraperManual.close();
        }
      }

      // ====== GERAÇÃO DE EXCEL ======
      let excelPath = '';
      let excelBuffer: Buffer | null = null;
      let fileName = '';
      const saveFilesToDisk = process.env.SAVE_FILES_TO_DISK !== 'false';

      if (anuncios.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fileName = `contratos_${timestamp}.xlsx`;
        const generator = new DiarioExcelGenerator();
        excelBuffer = await generator.generateExcel(anuncios);

        if (saveFilesToDisk) {
          // Salvar ficheiro no disco
          excelPath = path.join(this.config.resultsFolder, fileName);
          fs.writeFileSync(excelPath, excelBuffer);
          console.log(`${logPrefix} 📊 Excel gerado: ${excelPath}`);
        } else {
          console.log(`${logPrefix} ℹ️ SAVE_FILES_TO_DISK=false - Excel não será salvo no disco`);
        }
      }

      // ====== ENVIO DE EMAIL ======
      console.log(`\n${logPrefix} 📧 A preparar envio de email...`);
      const emailResult = await sendScrapingEmail(excelBuffer, fileName || 'relatorio.xlsx', anuncios.length, attemptMode, startTime);

      if (emailResult.sent) {
        console.log(`${logPrefix} ✅ ${emailResult.message}`);
      } else {
        console.log(`${logPrefix} ℹ️ ${emailResult.message}`);
      }

      // ====== LOG DE EXECUÇÃO ======
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      const logEntry = {
        timestamp: startTime.toISOString(),
        mode: attemptMode,
        success,
        anunciosCount: anuncios.length,
        duration: `${duration}s`,
        error: success ? null : 'Nenhum anúncio encontrado',
      };

      this.appendLog(logEntry);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`${logPrefix} ✅ EXECUÇÃO CONCLUÍDA`);
      console.log(`   Modo: ${attemptMode}`);
      console.log(`   Anúncios: ${anuncios.length}`);
      console.log(`   Duração: ${duration}s`);
      console.log(`${'='.repeat(60)}\n`);
    } catch (error: any) {
      console.error(`${logPrefix} ❌ ERRO CRÍTICO na execução:`, error);

      const logEntry = {
        timestamp: startTime.toISOString(),
        mode: attemptMode || 'Unknown',
        success: false,
        anunciosCount: 0,
        duration: '0s',
        error: error.message,
      };

      this.appendLog(logEntry);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Iniciar agendamento automático
   */
  start(): void {
    console.log(`📅 Scheduler iniciado. Execução agendada: ${this.config.cronExpression}`);
    console.log(`   Próxima execução: ${this.getNextExecutionTime()}`);
    console.log(`   Modo IA: ${this.config.tryAI ? 'Ativado (com fallback)' : 'Desativado'}`);
    console.log(`   Headless: ${this.config.headless}`);
    console.log(`   Max Results: ${this.config.maxResults || 'Sem limite'}`);

    cron.schedule(this.config.cronExpression, async () => {
      console.log(`\n⏰ Trigger de agendamento ativado: ${new Date().toISOString()}`);
      await this.runNow();
    });

    console.log('✅ Scheduler ativo. Pressione Ctrl+C para parar.\n');
  }

  /**
   * Calcular próxima execução
   */
  private getNextExecutionTime(): string {
    const now = new Date();
    const [minute, hour] = this.config.cronExpression.split(' ');

    const next = new Date(now);
    next.setHours(parseInt(hour), parseInt(minute), 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toLocaleString('pt-PT');
  }

  /**
   * Adicionar entrada ao log de execuções
   */
  private appendLog(entry: any): void {
    const logPath = path.join(this.config.resultsFolder, 'execution_log.json');
    let logs: any[] = [];

    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf-8');
      try {
        logs = JSON.parse(content);
      } catch {
        logs = [];
      }
    }

    logs.push(entry);

    // Manter apenas últimas 100 execuções
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  }

  /**
   * Ver últimas execuções
   */
  getRecentExecutions(limit: number = 10): any[] {
    const logPath = path.join(this.config.resultsFolder, 'execution_log.json');

    if (!fs.existsSync(logPath)) {
      return [];
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const logs = JSON.parse(content);

    return logs.slice(-limit).reverse();
  }
}
