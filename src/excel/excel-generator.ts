import ExcelJS from 'exceljs';
import { DiarioAnuncio } from '../scrapper/diario-republica-scraper.js';
import { CPV_CODES_LABELS } from '../cpv.js';

function getCPVDescription(cpv: string): string {
  return CPV_CODES_LABELS[cpv] || 'Sem descrição';
}

export interface ContractSimplified {
  title: string; // SUMÁRIO
  publicacao?: string; // Publicação (Diário da República)
  entity: string; // Emissor
  cpv: string; // Vocabulário Principal
  cpvDescription: string; // Descrição CPV (opcional)
  contractDate: string; // Data de Publicação
  contractValue?: string; // Preço Base
  contractNumber?: string; // Número do Anúncio
  url: string; // URL do Anúncio
}

export class DiarioExcelGenerator {
  /**
   * Gerar arquivo Excel com os anúncios do Diário da República
   * Retorna um Buffer que pode ser salvo em disco ou usado diretamente
   */
  async generateExcel(anuncios: DiarioAnuncio[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Anúncios de Seguros');

    // Definir colunas na ordem solicitada
    worksheet.columns = [
      { header: 'CPV (Vocabulário Principal)', key: 'cpvPrincipal', width: 25 },
      { header: 'Descrição do CPV', key: 'cpvDescricao', width: 50 },
      { header: 'Sumário', key: 'sumario', width: 60 },
      { header: 'Publicação', key: 'publicacao', width: 50 },
      { header: 'Emissor', key: 'emissor', width: 40 },
      { header: 'Data de Publicação', key: 'dataPublicacao', width: 18 },
      { header: 'Nº Anúncio', key: 'numeroAnuncio', width: 20 },
      { header: 'Entidade Adjudicante', key: 'entidadeAdjudicante', width: 40 },
      { header: 'Preço Base s/IVA', key: 'precoBaseSemIVA', width: 18 },
      { header: 'NIPC', key: 'nipc', width: 12 },
      { header: 'URL do Anúncio', key: 'url', width: 80 },
    ];

    // Estilizar cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Adicionar dados
    anuncios.forEach((anuncio) => {
      const row = worksheet.addRow({
        cpvPrincipal: anuncio.cpvPrincipal,
        cpvDescricao: getCPVDescription(anuncio.cpvPrincipal),
        sumario: anuncio.sumario,
        publicacao: anuncio.publicacao,
        emissor: anuncio.emissor,
        dataPublicacao: anuncio.dataPublicacao,
        numeroAnuncio: anuncio.numeroAnuncio,
        entidadeAdjudicante: anuncio.entidadeAdjudicante,
        precoBaseSemIVA: anuncio.precoBaseSemIVA,
        nipc: anuncio.nipc,
        url: anuncio.url,
      });

      // Adicionar hyperlink na URL
      const urlCell = row.getCell('url');
      urlCell.value = {
        text: anuncio.url,
        hyperlink: anuncio.url,
      };
      urlCell.font = { color: { argb: 'FF0066CC' }, underline: true };

      // Alternar cores de linhas
      if (row.number % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' },
        };
      }
    });

    // Adicionar filtros automáticos
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length },
    };

    // Adicionar rodapé com informações
    const summaryRow = worksheet.addRow([]);
    summaryRow.getCell(1).value = `Total de anúncios: ${anuncios.length}`;
    summaryRow.getCell(1).font = { bold: true };
    summaryRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB3B' },
    };

    // Adicionar data de geração
    const dateRow = worksheet.addRow([]);
    dateRow.getCell(1).value = `Gerado em: ${new Date().toLocaleString('pt-PT')}`;
    dateRow.getCell(1).font = { italic: true };

    // Retornar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Gerar relatório resumido em Excel
   */
  async generateSummaryExcel(anuncios: DiarioAnuncio[], fileName: string = 'diario-republica-resumo.xlsx'): Promise<string> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Resumo por CPV
    const cpvSheet = workbook.addWorksheet('Resumo por CPV');
    cpvSheet.columns = [
      { header: 'Código CPV', key: 'cpv', width: 12 },
      { header: 'Quantidade', key: 'count', width: 12 },
      { header: 'Valor Total Estimado', key: 'totalValue', width: 20 },
    ];

    // Agrupar por CPV
    const cpvGroups = new Map<string, { count: number; total: number }>();
    anuncios.forEach((anuncio) => {
      const cpv = anuncio.cpvPrincipal;
      if (!cpvGroups.has(cpv)) {
        cpvGroups.set(cpv, { count: 0, total: 0 });
      }
      const group = cpvGroups.get(cpv)!;
      group.count++;

      // Tentar extrair valor numérico
      const valueMatch = anuncio.precoBaseSemIVA.match(/[\d.,]+/);
      if (valueMatch) {
        const value = parseFloat(valueMatch[0].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(value)) {
          group.total += value;
        }
      }
    });

    // Adicionar dados ao sheet
    cpvGroups.forEach((data, cpv) => {
      cpvSheet.addRow({
        cpv,
        count: data.count,
        totalValue: `${data.total.toFixed(2)} EUR`,
      });
    });

    // Sheet 2: Resumo por Entidade
    const entitySheet = workbook.addWorksheet('Resumo por Entidade');
    entitySheet.columns = [
      { header: 'Entidade', key: 'entity', width: 50 },
      { header: 'Quantidade', key: 'count', width: 12 },
    ];

    // Agrupar por entidade
    const entityGroups = new Map<string, number>();
    anuncios.forEach((anuncio) => {
      const entity = anuncio.entidadeAdjudicante || anuncio.emissor;
      entityGroups.set(entity, (entityGroups.get(entity) || 0) + 1);
    });

    entityGroups.forEach((count, entity) => {
      entitySheet.addRow({ entity, count });
    });

    // Salvar arquivo
    const filePath = `./${fileName}`;
    await workbook.xlsx.writeFile(filePath);

    console.log(`\nArquivo Excel de resumo gerado: ${filePath}`);

    return filePath;
  }

  /**
   * Gerar Excel simplificado
   */
  async generateSimpleExcel(contracts: ContractSimplified[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Anúncios Publicados Ontem');

    // Cabeçalhos simples
    sheet.columns = [
      { header: 'SUMÁRIO', key: 'title', width: 60 },
      { header: 'Publicação', key: 'publicacao', width: 50 },
      { header: 'Emissor', key: 'entity', width: 40 },
      { header: 'Data de Publicação', key: 'contractDate', width: 18 },
      { header: 'Vocabulário Principal', key: 'cpv', width: 20 },
      { header: 'URL do Anúncio', key: 'url', width: 80 },
    ];

    // Header styling
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    // Adicionar dados
    contracts.forEach((c) => sheet.addRow(c));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
