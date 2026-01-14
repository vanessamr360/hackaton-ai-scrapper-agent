import { DiarioRepublicaScraper } from './diario-republica-scraper.js';
import { DiarioExcelGenerator } from '../excel/excel-generator.js';
import fs from 'fs';
import path from 'path';

import { CPV_CODES } from '../cpv.js';

/**
 * Função principal
 */
async function main() {
  console.log('=================================================');
  console.log('  Scraper Diário da República - Anúncios Públicos');
  console.log('  Automatização com Agente de IA');
  console.log('=================================================');
  console.log('\nPassos a executar:');
  console.log('1. Entrar no site https://diariodarepublica.pt/dr/home');
  console.log('2. Selecionar "Série II"');
  console.log('3. Selecionar o dia de ontem no calendário');
  console.log('4. Clicar em "Anúncios publicados"');
  console.log('5. Para cada resultado, verificar "Vocabulário Principal"');
  console.log('6. Recolher dados: Emissor, Data de Publicação, Vocabulário Principal');
  console.log('7. Processar todas as páginas (se houver paginação)');
  console.log('=================================================\n');

  const scraper = new DiarioRepublicaScraper();
  const excelGenerator = new DiarioExcelGenerator();

  try {
    // Para teste, usar apenas CPV 66512200
    /*     const cpvCodes = ['66512200'];
    console.log('\n⚠️  MODO TESTE: Usando apenas CPV 66512200\n'); */

    // Inicializar browser
    console.log('A inicializar browser...');
    const useAI = true; // Ativar IA (com fallback automático para scraper tradicional)
    await scraper.init(false, useAI); // headless = false para ver o processo

    if (useAI) {
      console.log('🤖 Modo IA ativado (com fallback automático para scraper tradicional)');
    }

    // Carregar CPV codes no scraper
    scraper.loadCPVCodes(CPV_CODES);

    // Coletar anúncios
    console.log('\n🤖 A iniciar recolha automática de anúncios...\n');
    // Para teste, limitar a 5 anúncios. Para produção, usar undefined (sem limite)
    const maxResults = 5; // undefined = sem limite
    const anuncios = await scraper.collectAnuncios(maxResults);

    if (anuncios.length === 0) {
      console.log('\n⚠ Nenhum anúncio encontrado com os CPV codes especificados.');
      console.log('   Verifique se existem anúncios publicados para o dia de ontem.');
    } else {
      console.log(`\n✓ ${anuncios.length} anúncio(s) relevante(s) encontrado(s)!`);
      console.log(`  (Apenas anúncios com CPV da lista foram recolhidos)\n`);

      // Gerar Excel
      console.log('\nA gerar arquivo Excel...');

      // Criar pasta results se não existir
      const resultsDir = path.join(process.cwd(), 'results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
        console.log('✓ Pasta results criada');
      }

      const now = new Date();
      const timestamp =
        now.toISOString().split('T')[0] +
        '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');
      const fileName = path.join(resultsDir, `diario-republica-seguros-${timestamp}.xlsx`);
      const excelBuffer = await excelGenerator.generateExcel(anuncios);
      fs.writeFileSync(fileName, excelBuffer);
      console.log(`\n✓ Excel gerado: ${fileName}`);

      // Gerar resumo
      await excelGenerator.generateSummaryExcel(anuncios, path.join(resultsDir, `diario-republica-resumo-${timestamp}.xlsx`));
    }
  } catch (error) {
    console.error('\n❌ Erro durante a execução:', error);
  } finally {
    // Fechar browser
    console.log('\nA fechar browser...');
    await scraper.close();
  }

  console.log('\n=================================================');
  console.log('  Processo concluído!');
  console.log('=================================================\n');
}

// Executar
main().catch(console.error);
