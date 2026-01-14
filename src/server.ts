import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getYesterdayDate } from './utils.js';
import { CPV_CODES, CPV_JSON, CPV_CODES_LABELS } from './cpv.js';

import { DiarioRepublicaScraper } from './scrapper/diario-republica-scraper.js';
import { DiarioExcelGenerator } from './excel/excel-generator.js';
import { sendScrapingEmail } from './email/email-sender.js';
import { getEmailRecipients } from './email/email-service.js';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend folder
// When compiled: __dirname is backend/dist, so go up twice to reach project root
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'API a funcionar' });
});

/**
 * GET /api/contracts/yesterday
 * Recolhe anúncios de seguros do dia anterior e retorna Excel simplificado em base64
 * Query params:
 *   - maxResults: número máximo de anúncios a processar (opcional, default = sem limite)
 */
app.get('/api/contracts/yesterday', async (req: Request, res: Response) => {
  const scraper = new DiarioRepublicaScraper();
  const excelGenerator = new DiarioExcelGenerator();

  try {
    // Obter parâmetro maxResults da query string
    const maxResults = req.query.maxResults ? parseInt(req.query.maxResults as string) : undefined;

    if (maxResults && maxResults < 1) {
      return res.status(400).json({
        success: false,
        error: 'maxResults deve ser um número maior que 0',
      });
    }

    console.log('Iniciando recolha de anúncios do dia anterior...');
    if (maxResults) {
      console.log(`Limite máximo: ${maxResults} anúncios`);
    }

    // Inicializar browser
    const headless = process.env.HEADLESS !== 'false';
    const useAI = process.env.USE_AI === 'true'; // Definir USE_AI=true no .env para ativar IA
    await scraper.init(headless, useAI);

    if (useAI) {
      console.log('🤖 Modo IA ativado (com fallback automático)');
    }

    // Carregar CPV codes
    scraper.loadCPVCodes(CPV_CODES);

    // Recolher anúncios
    console.log('A recolher anúncios...');
    const anuncios = await scraper.collectAnuncios(maxResults);

    console.log(`${anuncios.length} anúncios encontrados`);

    // Converter para formato simplificado
    const contractsSimplified = anuncios.map((a) => ({
      title: a.sumario || a.numeroAnuncio,
      publicacao: a.publicacao,
      entity: a.emissor,
      cpv: a.cpvPrincipal,
      cpvDescription: '', // Pode adicionar lookup do CPV_JSON se necessário
      contractDate: a.dataPublicacao,
      contractValue: a.precoBaseSemIVA,
      contractNumber: a.numeroAnuncio,
      url: a.url,
    }));

    // Extrair CPV codes únicos encontrados
    const cpvCodesFound = [...new Set(anuncios.map((a) => a.cpvPrincipal).filter(Boolean))];

    // Gerar Excel simplificado
    const excelBuffer = await excelGenerator.generateSimpleExcel(contractsSimplified);
    const excelBase64 = excelBuffer.toString('base64');

    const startDate = getYesterdayDate();

    // Retornar resposta
    return res.json({
      success: true,
      date: startDate,
      totalContracts: anuncios.length,
      maxResults: maxResults || null,
      cpvCodes: cpvCodesFound,
      report: {
        filename: `anuncios_seguros_${startDate}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: excelBase64,
      },
      contracts: contractsSimplified.slice(0, 10), // Preview dos primeiros 10
    });
  } catch (error: any) {
    console.error('Erro ao recolher anúncios:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    await scraper.close();
  }
});

/**
 * POST /api/contracts/search
 * Pesquisa personalizada de anúncios
 * Body: {
 *   cpvCodes?: string[],
 *   date?: string (formato YYYY-MM-DD),
 *   sendEmail?: boolean,
 *   maxResults?: number
 * }
 */
app.post('/api/contracts/search', async (req: Request, res: Response) => {
  const scraper = new DiarioRepublicaScraper();
  const excelGenerator = new DiarioExcelGenerator();

  try {
    // Obter parâmetros do body
    const { cpvCodes, date, sendEmail, maxResults } = req.body;

    // Validar date (deve ser YYYY-MM-DD)
    let targetDate = date || getYesterdayDate();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      return res.status(400).json({
        success: false,
        error: 'Data inválida. Use formato YYYY-MM-DD',
      });
    }

    // Validar maxResults
    if (maxResults && maxResults < 1) {
      return res.status(400).json({
        success: false,
        error: 'maxResults deve ser um número maior que 0',
      });
    }

    // Validar CPV codes (se fornecidos)
    if (cpvCodes && cpvCodes.length > 0) {
      const invalidCodes = cpvCodes.filter((code: string) => !CPV_CODES.includes(code));
      if (invalidCodes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Códigos CPV inválidos: ${invalidCodes.join(', ')}`,
          validCodes: CPV_CODES,
        });
      }
    }

    console.log('Iniciando pesquisa personalizada de anúncios...');
    console.log(`Data: ${targetDate}`);
    if (maxResults) {
      console.log(`Limite máximo: ${maxResults} anúncios`);
    }

    // Inicializar browser
    const headless = process.env.HEADLESS !== 'false';
    const useAI = process.env.USE_AI === 'true';
    await scraper.init(headless, useAI);

    if (useAI) {
      console.log('🤖 Modo IA ativado (com fallback automático)');
    }

    // Carregar CPV codes (personalizados ou padrão)
    const codesToUse = cpvCodes && cpvCodes.length > 0 ? cpvCodes : CPV_CODES;
    scraper.loadCPVCodes(codesToUse);
    console.log(`CPV codes a filtrar: ${codesToUse.length}`);

    // Recolher anúncios
    console.log('A recolher anúncios...');
    const anuncios = await scraper.collectAnuncios(maxResults);

    console.log(`${anuncios.length} anúncios encontrados`);

    // Converter para formato simplificado
    const contractsSimplified = anuncios.map((a) => ({
      title: a.sumario || a.numeroAnuncio,
      publicacao: a.publicacao,
      entity: a.emissor,
      cpv: a.cpvPrincipal,
      cpvDescription: '',
      contractDate: a.dataPublicacao,
      contractValue: a.precoBaseSemIVA,
      contractNumber: a.numeroAnuncio,
      url: a.url,
    }));

    // Extrair CPV codes únicos encontrados
    const cpvCodesFound = [...new Set(anuncios.map((a) => a.cpvPrincipal).filter(Boolean))];

    // Gerar Excel (apenas buffer, sem salvar em disco)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `contratos_search_${timestamp}.xlsx`;
    const excelBuffer = await excelGenerator.generateExcel(anuncios);

    // Converter para base64 para resposta
    const excelBase64 = excelBuffer.toString('base64');

    // Enviar email se solicitado
    let emailSuccess = false;
    let emailSendTo: string[] = [];

    if (sendEmail === true) {
      console.log('Enviando email...');
      const emailResult = await sendScrapingEmail(excelBuffer, fileName, anuncios.length, useAI ? 'IA' : 'Manual', new Date());

      emailSuccess = emailResult.sent;
      emailSendTo = emailResult.sent ? getEmailRecipients() : [];

      if (emailSuccess) {
        console.log(`Email enviado para ${emailSendTo.length} destinatário(s)`);
      } else {
        console.log(`Email não enviado: ${emailResult.message}`);
      }
    }

    // Retornar resposta
    return res.json({
      success: true,
      emailSuccess,
      emailSendTo,
      date: targetDate,
      totalContracts: anuncios.length,
      maxResults: maxResults || null,
      cpvCodes: cpvCodesFound,
      report: {
        filename: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: excelBase64,
      },
      contracts: contractsSimplified.slice(0, 10), // Preview dos primeiros 10
    });
  } catch (error: any) {
    console.error('Erro ao pesquisar anúncios:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    await scraper.close();
  }
});

/**
 * GET /api/cpv-codes
 * Lista códigos CPV disponíveis para seguros
 */
app.get('/api/cpv-codes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    cpvCodes: CPV_CODES_LABELS,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API a correr em http://localhost:${PORT}`);
  console.log(`📊 Endpoint principal: GET http://localhost:${PORT}/api/contracts/yesterday`);
  console.log(`   Query params: ?maxResults=<número> (opcional - limita resultados)`);
  console.log(`🔍 Pesquisa personalizada: POST http://localhost:${PORT}/api/contracts/search`);
  console.log(`📋 Códigos CPV: GET http://localhost:${PORT}/api/cpv-codes`);
});

export default app;
