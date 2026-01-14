/**
 * Script para testar os endpoints da API REST
 *
 * IMPORTANTE: O servidor deve estar em execução antes de executar este teste
 * Execute primeiro: npm run dev (ou npm start)
 *
 * Uso:
 *   npm run test:api
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  statusCode?: number;
  message: string;
  responseTime?: number;
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const results: TestResult[] = [];

/**
 * Fazer requisição HTTP
 */
async function makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<{ status: number; data: any; time: number }> {
  const startTime = Date.now();

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  const time = Date.now() - startTime;

  return { status: response.status, data, time };
}

/**
 * Teste 1: Health Check
 */
async function testHealthCheck(): Promise<void> {
  console.log('\n📍 Teste 1: Health Check');
  console.log('   Endpoint: GET /health');

  try {
    const { status, data, time } = await makeRequest('/health');

    if (status === 200 && data.status === 'ok') {
      results.push({
        endpoint: '/health',
        method: 'GET',
        status: 'SUCCESS',
        statusCode: status,
        message: `✅ API está online (${time}ms)`,
        responseTime: time,
      });
      console.log(`   ✅ Sucesso: ${data.message} (${time}ms)`);
    } else {
      results.push({
        endpoint: '/health',
        method: 'GET',
        status: 'FAILED',
        statusCode: status,
        message: `❌ Resposta inesperada`,
        responseTime: time,
      });
      console.log(`   ❌ Falha: Resposta inesperada`);
    }
  } catch (error: any) {
    results.push({
      endpoint: '/health',
      method: 'GET',
      status: 'FAILED',
      message: `❌ Erro: ${error.message}`,
    });
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

/**
 * Teste 2: Lista de CPV Codes
 */
async function testCPVCodes(): Promise<void> {
  console.log('\n📍 Teste 2: Lista de CPV Codes');
  console.log('   Endpoint: GET /api/cpv-codes');

  try {
    const { status, data, time } = await makeRequest('/api/cpv-codes');

    if (status === 200 && data.success && data.cpvCodes) {
      const codesCount = Object.keys(data.cpvCodes).length;
      results.push({
        endpoint: '/api/cpv-codes',
        method: 'GET',
        status: 'SUCCESS',
        statusCode: status,
        message: `✅ ${codesCount} códigos CPV disponíveis (${time}ms)`,
        responseTime: time,
      });
      console.log(`   ✅ Sucesso: ${codesCount} códigos CPV (${time}ms)`);
      console.log(`   📋 Exemplos: ${Object.keys(data.cpvCodes).slice(0, 3).join(', ')}...`);
    } else {
      results.push({
        endpoint: '/api/cpv-codes',
        method: 'GET',
        status: 'FAILED',
        statusCode: status,
        message: `❌ Resposta inesperada`,
        responseTime: time,
      });
      console.log(`   ❌ Falha: Resposta inesperada`);
    }
  } catch (error: any) {
    results.push({
      endpoint: '/api/cpv-codes',
      method: 'GET',
      status: 'FAILED',
      message: `❌ Erro: ${error.message}`,
    });
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

/**
 * Teste 3: Contratos de Ontem (com limite)
 */
async function testContractsYesterday(): Promise<void> {
  console.log('\n📍 Teste 3: Contratos de Ontem');
  console.log('   Endpoint: GET /api/contracts/yesterday?maxResults=2');
  console.log('   ⚠️  Este teste pode demorar vários minutos (scraping real)');

  const confirmTest = process.env.TEST_SCRAPING === 'true';

  if (!confirmTest) {
    results.push({
      endpoint: '/api/contracts/yesterday',
      method: 'GET',
      status: 'SKIPPED',
      message: '⏭️ Teste ignorado (requer TEST_SCRAPING=true)',
    });
    console.log('   ⏭️ IGNORADO: Para ativar, defina TEST_SCRAPING=true no .env');
    return;
  }

  try {
    const { status, data, time } = await makeRequest('/api/contracts/yesterday?maxResults=2');

    if (status === 200 && data.success) {
      results.push({
        endpoint: '/api/contracts/yesterday',
        method: 'GET',
        status: 'SUCCESS',
        statusCode: status,
        message: `✅ ${data.totalContracts} contratos encontrados (${time}ms)`,
        responseTime: time,
      });
      console.log(`   ✅ Sucesso: ${data.totalContracts} contratos (${time}ms)`);
      console.log(`   📅 Data: ${data.date}`);
      console.log(`   📊 Excel: ${data.report.filename}`);
    } else {
      results.push({
        endpoint: '/api/contracts/yesterday',
        method: 'GET',
        status: 'FAILED',
        statusCode: status,
        message: `❌ ${data.error || 'Resposta inesperada'}`,
        responseTime: time,
      });
      console.log(`   ❌ Falha: ${data.error || 'Resposta inesperada'}`);
    }
  } catch (error: any) {
    results.push({
      endpoint: '/api/contracts/yesterday',
      method: 'GET',
      status: 'FAILED',
      message: `❌ Erro: ${error.message}`,
    });
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

/**
 * Teste 4: Pesquisa Personalizada - Validação de CPV inválido
 */
async function testSearchInvalidCPV(): Promise<void> {
  console.log('\n📍 Teste 4: Pesquisa com CPV Inválido');
  console.log('   Endpoint: POST /api/contracts/search');

  try {
    const { status, data, time } = await makeRequest('/api/contracts/search', 'POST', {
      cpvCodes: ['99999999-9', '88888888-8'],
      date: '2026-01-13',
      maxResults: 1,
    });

    if (status === 400 && data.error && data.error.includes('inválidos')) {
      results.push({
        endpoint: '/api/contracts/search',
        method: 'POST',
        status: 'SUCCESS',
        statusCode: status,
        message: `✅ Validação de CPV funcionando (${time}ms)`,
        responseTime: time,
      });
      console.log(`   ✅ Sucesso: Validação rejeitou CPVs inválidos (${time}ms)`);
      console.log(`   📋 Erro esperado: ${data.error}`);
    } else {
      results.push({
        endpoint: '/api/contracts/search',
        method: 'POST',
        status: 'FAILED',
        statusCode: status,
        message: `❌ Validação não funcionou como esperado`,
        responseTime: time,
      });
      console.log(`   ❌ Falha: Deveria rejeitar CPVs inválidos`);
    }
  } catch (error: any) {
    results.push({
      endpoint: '/api/contracts/search',
      method: 'POST',
      status: 'FAILED',
      message: `❌ Erro: ${error.message}`,
    });
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

/**
 * Teste 5: Pesquisa Personalizada - Com CPVs válidos
 */
async function testSearchValidCPV(): Promise<void> {
  console.log('\n📍 Teste 5: Pesquisa com CPVs Válidos');
  console.log('   Endpoint: POST /api/contracts/search');
  console.log('   ⚠️  Este teste pode demorar vários minutos (scraping real)');

  const confirmTest = process.env.TEST_SCRAPING === 'true';

  if (!confirmTest) {
    results.push({
      endpoint: '/api/contracts/search',
      method: 'POST',
      status: 'SKIPPED',
      message: '⏭️ Teste ignorado (requer TEST_SCRAPING=true)',
    });
    console.log('   ⏭️ IGNORADO: Para ativar, defina TEST_SCRAPING=true no .env');
    return;
  }

  try {
    const { status, data, time } = await makeRequest('/api/contracts/search', 'POST', {
      cpvCodes: ['66512200-4'],
      date: '2026-01-13',
      sendEmail: false,
      maxResults: 2,
    });

    if (status === 200 && data.success) {
      results.push({
        endpoint: '/api/contracts/search',
        method: 'POST',
        status: 'SUCCESS',
        statusCode: status,
        message: `✅ ${data.totalContracts} contratos encontrados (${time}ms)`,
        responseTime: time,
      });
      console.log(`   ✅ Sucesso: ${data.totalContracts} contratos (${time}ms)`);
      console.log(`   📅 Data: ${data.date}`);
      console.log(`   📊 Excel: ${data.report.filename}`);
      console.log(`   📧 Email: ${data.emailSuccess ? 'Enviado' : 'Não enviado'}`);
    } else {
      results.push({
        endpoint: '/api/contracts/search',
        method: 'POST',
        status: 'FAILED',
        statusCode: status,
        message: `❌ ${data.error || 'Resposta inesperada'}`,
        responseTime: time,
      });
      console.log(`   ❌ Falha: ${data.error || 'Resposta inesperada'}`);
    }
  } catch (error: any) {
    results.push({
      endpoint: '/api/contracts/search',
      method: 'POST',
      status: 'FAILED',
      message: `❌ Erro: ${error.message}`,
    });
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

/**
 * Mostrar resumo dos testes
 */
function showSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));

  const success = results.filter((r) => r.status === 'SUCCESS').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  const skipped = results.filter((r) => r.status === 'SKIPPED').length;
  const total = results.length;

  console.log(`\nTotal de testes: ${total}`);
  console.log(`✅ Sucesso: ${success}`);
  console.log(`❌ Falhas: ${failed}`);
  console.log(`⏭️  Ignorados: ${skipped}`);

  console.log('\nDetalhes:');
  results.forEach((result, index) => {
    const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'FAILED' ? '❌' : '⏭️';
    console.log(`${index + 1}. ${icon} ${result.method} ${result.endpoint}`);
    console.log(`   ${result.message}`);
  });

  console.log('\n' + '='.repeat(60));

  if (failed > 0) {
    console.log('❌ Alguns testes falharam!');
    process.exit(1);
  } else if (success === 0 && skipped > 0) {
    console.log('⚠️  Todos os testes de scraping foram ignorados.');
    console.log('   Para executar testes completos, defina TEST_SCRAPING=true no .env');
  } else {
    console.log('✅ Todos os testes passaram!');
  }
}

/**
 * Executar todos os testes
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 TESTE DE APIs - DDR Scraper');
  console.log('='.repeat(60));
  console.log(`\n🌐 URL Base: ${API_BASE_URL}`);
  console.log(`⚙️  Modo Scraping: ${process.env.TEST_SCRAPING === 'true' ? 'ATIVADO' : 'DESATIVADO'}`);

  if (process.env.TEST_SCRAPING !== 'true') {
    console.log('\n⚠️  AVISO: Testes de scraping estão desativados.');
    console.log('   Para ativar, adicione TEST_SCRAPING=true no .env');
  }

  try {
    // Testes rápidos (sem scraping)
    await testHealthCheck();
    await testCPVCodes();
    await testSearchInvalidCPV();

    // Testes de scraping (opcionais, demorados)
    await testContractsYesterday();
    await testSearchValidCPV();

    showSummary();
  } catch (error: any) {
    console.error('\n❌ ERRO CRÍTICO durante os testes:', error.message);
    process.exit(1);
  }
}

// Verificar se o servidor está em execução
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}

// Executar
(async () => {
  console.log('🔍 Verificando se o servidor está em execução...');

  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.error('\n❌ ERRO: Servidor não está em execução!');
    console.error(`   URL testada: ${API_BASE_URL}/health`);
    console.error('\n💡 Solução: Execute o servidor primeiro:');
    console.error('   npm run dev   (modo desenvolvimento)');
    console.error('   npm start     (modo produção)');
    console.error('\nDepois execute novamente: npm run test:api');
    process.exit(1);
  }

  console.log('✅ Servidor está online!\n');

  await runTests();
})();
