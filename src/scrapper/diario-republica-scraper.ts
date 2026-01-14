import { chromium, Browser, Page } from 'playwright';
import { AINavigationAgent } from '../openai/agent.js';

export interface DiarioAnuncio {
  sumario: string; // SUMÁRIO do anúncio
  publicacao: string; // Diário da República n.º X/YYYY, Série II de YYYY-MM-DD
  emissor: string; // Emissor (obrigatório)
  dataPublicacao: string; // Data de Publicação (obrigatório)
  cpvPrincipal: string; // Vocabulário Principal (obrigatório)
  url: string; // URL do anúncio

  // Campos adicionais (opcionais)
  numeroAnuncio: string;
  dataPesquisa: string;
  entidadeAdjudicante: string;
  nipc: string;
  precoBaseSemIVA: string;
  precoBaseComIVA?: string;
  dataEnvioAnuncio?: string;
  tipoContrato: string;
  descricao: string;
  numeroReferencia?: string;
  designacaoContrato?: string;
  numeroProcesso?: string;
  distristo?: string;
  concelho?: string;
  localidade?: string;
  nutIII?: string;
}

export class DiarioRepublicaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cpvCodes: string[] = [];
  private resultsPageUrl: string = ''; // URL da página de resultados
  private aiAgent: AINavigationAgent | null = null;
  private useAI: boolean = false;

  async init(headless: boolean = false, useAI: boolean = false): Promise<void> {
    this.useAI = useAI;

    // Tentar inicializar agente de IA se solicitado
    if (useAI) {
      try {
        this.aiAgent = new AINavigationAgent();
        // Verificar se o agente foi realmente inicializado (tem cliente)
        if (this.aiAgent && this.aiAgent.isActive()) {
          console.log('✅ Agente de IA inicializado com sucesso');
        } else {
          console.log('⚠ Agente de IA criado mas Azure OpenAI não configurado. Usando scraper tradicional.');
          this.useAI = false;
          this.aiAgent = null;
        }
      } catch (error: any) {
        console.log('⚠ Falha ao inicializar agente de IA:', error.message);
        console.log('   Usando scraper tradicional.');
        this.useAI = false;
        this.aiAgent = null;
      }
    }

    this.browser = await chromium.launch({
      headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    this.page = await context.newPage();
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Carregar CPV codes da lista de referência
   */
  loadCPVCodes(cpvCodes: string[]): void {
    this.cpvCodes = cpvCodes;
    console.log(`Carregados ${cpvCodes.length} códigos CPV para filtrar`);
  }

  /**
   * Tentar usar IA para ajudar na navegação, com fallback para método tradicional
   */
  private async tryAINavigationWithFallback<T>(aiAction: () => Promise<T>, fallbackAction: () => Promise<T>, actionDescription: string): Promise<T> {
    if (this.useAI && this.aiAgent) {
      try {
        console.log(`🤖 Tentando usar IA para: ${actionDescription}`);
        return await aiAction();
      } catch (error) {
        console.log(`⚠ IA falhou para ${actionDescription}. Usando fallback tradicional.`);
        console.log(`   Erro: ${error}`);
        this.useAI = false; // Desativar IA para próximas tentativas
      }
    }

    // Usar método tradicional (fallback ou se IA não está ativa)
    return await fallbackAction();
  }

  /**
   * Obter a data do dia anterior no formato necessário
   */
  private getYesterdayDate(): { day: string; month: string; year: string } {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      day: yesterday.getDate().toString(),
      month: (yesterday.getMonth() + 1).toString(),
      year: yesterday.getFullYear().toString(),
    };
  }

  /**
   * Navegar para a página inicial e selecionar Série II + dia anterior
   * Passos:
   * 1. Entrar no site https://diariodarepublica.pt/dr/home
   * 2. Selecionar 'Série II'
   * 3. Selecionar o dia de ontem no calendário
   * 4. Clicar em 'Anúncios publicados'
   */
  async navigateToAnunciosPublicados(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser não inicializado. Chame init() primeiro.');
    }

    // PASSO 1: Entrar no site
    console.log('[PASSO 1] A navegar para Diário da República...');
    await this.page.goto('https://diariodarepublica.pt/dr/home', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await this.page.waitForTimeout(2000);

    // PASSO 2: Selecionar Série II
    console.log('[PASSO 2] A selecionar Série II...');
    const serieIIButton = this.page.locator('button:has-text("Série II"), a:has-text("Série II")').first();
    await serieIIButton.click();
    await this.page.waitForTimeout(2000);

    // PASSO 3: Selecionar o dia de ontem no calendário
    const { day, month, year } = this.getYesterdayDate();
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');

    console.log(`[PASSO 3] A selecionar o dia anterior: ${day}/${month}/${year}...`);

    // Procurar pela célula do calendário usando o atributo title
    // Exemplo: title="Ir para o dia 2026-01-12"
    const targetTitle = `Ir para o dia ${year}-${paddedMonth}-${paddedDay}`;
    console.log(`Procurando célula com title: "${targetTitle}"`);

    await this.page.waitForTimeout(2000);

    // Screenshot antes de clicar
    await this.page.screenshot({ path: 'debug_calendario_antes_click.png' });

    // Tentar clicar usando o atributo title
    const dayCell = this.page.locator(`td[title="${targetTitle}"], a[title="${targetTitle}"]`).first();

    if ((await dayCell.count()) > 0) {
      console.log(`✓ Célula encontrada com title correto`);
      await dayCell.click();
      await this.page.waitForTimeout(3000);
      console.log(`✓ Clique executado no dia ${day}`);
    } else {
      console.log(`⚠ Célula não encontrada com title. Tentando JavaScript...`);

      // Fallback: usar JavaScript para procurar por title
      const clicked = await this.page.evaluate((targetTitle: string) => {
        const cells = Array.from(document.querySelectorAll('td, a'));
        for (const cell of cells) {
          const title = cell.getAttribute('title');
          if (title && title.includes(targetTitle)) {
            console.log(`Encontrada célula com title: ${title}`);
            (cell as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, targetTitle);

      if (clicked) {
        console.log(`✓ Clique executado via JavaScript`);
        await this.page.waitForTimeout(3000);
      } else {
        console.log(`✗ Não foi possível encontrar o dia ${day} no calendário`);
        // Tentar navegar diretamente pela URL como fallback
        const targetUrl = `https://diariodarepublica.pt/dr/home?serie=II&date=${year}-${paddedMonth}-${paddedDay}#`;
        console.log(`Tentando navegação direta: ${targetUrl}`);
        await this.page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(2000);
      }
    }

    // Screenshot após a ação
    await this.page.screenshot({ path: 'debug_calendario_depois_click.png' });

    // Verificar URL atual
    const currentUrl = this.page.url();
    const pageTitle = await this.page.title();
    console.log(`Página atual: ${pageTitle}`);
    console.log(`URL atual: ${currentUrl}`);

    // PASSO 4: Clicar em 'Anúncios publicados'
    console.log('[PASSO 4] A clicar em Anúncios publicados...');
    const anunciosLink = this.page.locator('a:has-text("Anúncios publicados"), a[href*="contratos"], a[href*="anuncio"]').first();

    if ((await anunciosLink.count()) > 0) {
      await anunciosLink.click();
      await this.page.waitForTimeout(3000);

      // Guardar a URL da página de resultados
      this.resultsPageUrl = this.page.url();
      console.log(`✓ Anúncios publicados abertos`);
      console.log(`✓ URL da página de resultados guardada: ${this.resultsPageUrl}`);
    } else {
      console.log('⚠ Link de Anúncios publicados não encontrado, procurando alternativas...');
      // Screenshot para debug
      await this.page.screenshot({ path: 'debug_anuncios_nao_encontrados.png', fullPage: true });
      throw new Error('Não foi possível encontrar a secção de Anúncios publicados');
    }
  }

  /**
   * Extrair links de anúncios apenas da página atual
   */
  async extractCurrentPageLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error('Browser não inicializado.');
    }

    const urls: string[] = [];

    // Procurar por links de anúncios de procedimento na página atual
    const links = await this.page.locator('a[href*="/dr/detalhe/anuncio-procedimento/"]').all();

    for (const link of links) {
      const href = await link.getAttribute('href');
      // Filtrar apenas URLs válidos (ignorar mailto: e outros)
      if (href && href.startsWith('/dr/detalhe/anuncio-procedimento/') && !href.includes('mailto')) {
        const fullUrl = `https://diariodarepublica.pt${href}`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    }

    return urls;
  }

  /**
   * Tentar navegar para a próxima página de resultados
   * Retorna true se conseguiu navegar, false se não há mais páginas
   */
  async goToNextPage(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser não inicializado.');
    }

    // Verificar se existe indicador de mais páginas: "Pág. X de Y"
    const paginationInfo = await this.page
      .locator('text=/Pág\\. \\d+ de \\d+/')
      .first()
      .textContent()
      .catch(() => '');

    if (paginationInfo) {
      const match = paginationInfo.match(/Pág\. (\d+) de (\d+)/);
      if (match) {
        const currentPage = parseInt(match[1]);
        const totalPages = parseInt(match[2]);

        // Se já estamos na última página, retornar false
        if (currentPage >= totalPages) {
          console.log(`  Última página alcançada (${currentPage} de ${totalPages})`);
          return false;
        }

        // Tentar clicar no próximo número de página
        const nextPageNum = currentPage + 1;
        const nextPageButton = this.page.locator(`a.page-link:has-text("${nextPageNum}"), a:has-text("${nextPageNum}")`).first();

        if ((await nextPageButton.count()) > 0) {
          console.log(`  Navegando para página ${nextPageNum}...`);
          await nextPageButton.click();
          await this.page.waitForTimeout(3000);
          return true;
        }
      }
    }

    // Se não encontrou informação de paginação, tentar botão "próxima"
    const nextButton = this.page.locator('a:has-text("›"), a:has-text("Próxima"), a.next').first();
    if ((await nextButton.count()) > 0) {
      console.log(`  Clicando em "Próxima"...`);
      await nextButton.click();
      await this.page.waitForTimeout(3000);
      return true;
    }

    return false;
  }

  /**
   * Extrair todos os links de anúncios da página (com paginação)
   * @deprecated Use collectAnuncios() que processa página por página
   */
  async extractAnuncioLinks(): Promise<string[]> {
    if (!this.page) {
      throw new Error('Browser não inicializado.');
    }

    console.log('A extrair links de anúncios (incluindo todas as páginas)...');

    const allUrls: string[] = [];
    let pageNumber = 1;

    while (true) {
      console.log(`  Página ${pageNumber}...`);

      // Aguardar a página carregar completamente
      await this.page.waitForTimeout(3000);

      // Screenshot para debug da paginação
      if (pageNumber === 1) {
        await this.page.screenshot({ path: 'debug_paginacao.png', fullPage: true });
        console.log(`  Screenshot salvo: debug_paginacao.png`);
      }

      // Verificar informação de paginação
      const paginationText = await this.page
        .locator('text=/Pág\\. \\d+ de \\d+/')
        .first()
        .textContent()
        .catch(() => '');
      if (paginationText) {
        console.log(`  ${paginationText}`);
      } else {
        console.log(`  ⚠ Texto de paginação não encontrado`);
      }

      // Procurar por links de anúncios de procedimento na página atual
      const links = await this.page.locator('a[href*="/dr/detalhe/anuncio-procedimento/"]').all();

      let foundInThisPage = 0;
      for (const link of links) {
        const href = await link.getAttribute('href');
        // Filtrar apenas URLs válidos (ignorar mailto: e outros)
        if (href && href.startsWith('/dr/detalhe/anuncio-procedimento/') && !href.includes('mailto')) {
          const fullUrl = `https://diariodarepublica.pt${href}`;
          if (!allUrls.includes(fullUrl)) {
            allUrls.push(fullUrl);
            foundInThisPage++;
          }
        }
      }

      console.log(`  Encontrados ${foundInThisPage} anúncios novos nesta página`);

      // Verificar se existe indicador de mais páginas: "Pág. X de Y"
      const paginationInfo = await this.page
        .locator('text=/Pág\\. \\d+ de \\d+/')
        .first()
        .textContent()
        .catch(() => '');

      if (paginationInfo) {
        const match = paginationInfo.match(/Pág\. (\d+) de (\d+)/);
        if (match) {
          const currentPage = parseInt(match[1]);
          const totalPages = parseInt(match[2]);

          // Se já estamos na última página, parar
          if (currentPage >= totalPages) {
            console.log(`  Última página alcançada (${currentPage} de ${totalPages})`);
            break;
          }

          // Tentar clicar no próximo número de página
          const nextPageNum = currentPage + 1;
          const nextPageButton = this.page.locator(`a.page-link:has-text("${nextPageNum}"), a:has-text("${nextPageNum}")`).first();

          if ((await nextPageButton.count()) > 0) {
            console.log(`  Navegando para página ${nextPageNum}...`);
            await nextPageButton.click();
            await this.page.waitForTimeout(2000);
            pageNumber = nextPageNum;
            continue;
          } else {
            console.log(`  Botão da página ${nextPageNum} não encontrado`);
            break;
          }
        }
      }

      // Se não encontrou informação de paginação, tentar botão "próxima"
      const nextButton = this.page.locator('a:has-text("›"), a:has-text("Próxima"), a.next').first();
      if ((await nextButton.count()) > 0) {
        console.log(`  Clicando em "Próxima"...`);
        await nextButton.click();
        await this.page.waitForTimeout(2000);
        pageNumber++;
        continue;
      }

      console.log(`  Não há mais páginas. Total: ${pageNumber} página(s)`);
      break;
    }

    console.log(`Encontrados ${allUrls.length} anúncios no total`);
    return allUrls;
  }

  /**
   * Extrair dados de um anúncio específico
   * PASSO 5: Clicar em cada resultado e verificar se o valor à frente de
   * 'Vocabulário Principal:' existe no array de CPV
   */
  async extractAnuncioData(url: string, dataPesquisa: string, maxResults?: number): Promise<DiarioAnuncio | null> {
    if (!this.page) {
      throw new Error('Browser não inicializado.');
    }

    // Validar URL antes de processar
    if (!url || !url.startsWith('http') || url.includes('mailto')) {
      console.log(`  ⚠ URL inválido ignorado: ${url}`);
      return null;
    }

    return this.tryAINavigationWithFallback(
      // Ação com IA
      async () => await this.extractWithAI(url, dataPesquisa, maxResults),
      // Fallback tradicional
      async () => await this.extractTraditional(url, dataPesquisa),
      'extrair dados do anúncio'
    );
  }

  /**
   * Extração com ajuda da IA
   */
  private async extractWithAI(url: string, dataPesquisa: string, maxResults?: number): Promise<DiarioAnuncio | null> {
    if (!this.page || !this.aiAgent) {
      throw new Error('Browser ou Agente de IA não inicializado.');
    }

    console.log(`[PASSO 5 - IA] A processar anúncio com IA: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(2000);

    // Obter sugestão da IA sobre como extrair dados
    const htmlContent = await this.page.content();
    console.log(`  📄 HTML obtido: ${htmlContent.length} caracteres`);

    const extractedData = await this.aiAgent.extractStructuredData(
      htmlContent,
      'Extrair dados do anúncio: Emissor, Data de Publicação, Vocabulário Principal',
      maxResults
    );

    console.log(`  🤖 IA retornou ${extractedData?.length || 0} resultados`);

    if (!extractedData || extractedData.length === 0) {
      console.log(`  ⚠️ IA não conseguiu extrair dados, usando fallback tradicional`);
      throw new Error('IA não conseguiu extrair dados');
    }

    const data = extractedData[0];
    console.log(`  📊 Dados extraídos pela IA:`, JSON.stringify(data, null, 2));

    // Validar se tem os campos obrigatórios
    if (!data.emissor || !data.dataPublicacao || !data.vocabularioPrincipal) {
      console.log(`  ⚠️ IA não retornou campos obrigatórios, usando fallback tradicional`);
      throw new Error('IA não retornou dados obrigatórios');
    }

    // Verificar CPV
    if (this.cpvCodes.length > 0 && !this.cpvCodes.includes(data.vocabularioPrincipal)) {
      console.log(`  ✗ CPV ${data.vocabularioPrincipal} não está na lista de referência. Ignorando...`);
      await this.returnToResultsPage();
      return null;
    }

    console.log(`  ✓ CPV ${data.vocabularioPrincipal} encontrado na lista! (via IA)`);

    // Voltar para a página de resultados
    await this.returnToResultsPage();

    return {
      sumario: data.title || '',
      publicacao: '',
      emissor: data.emissor,
      dataPublicacao: data.dataPublicacao,
      cpvPrincipal: data.vocabularioPrincipal,
      url,
      numeroAnuncio: data.contractNumber || '',
      dataPesquisa,
      entidadeAdjudicante: data.entidadeAdjudicante || '',
      nipc: '',
      precoBaseSemIVA: data.contractValue || '',
      dataEnvioAnuncio: '',
      tipoContrato: '',
      descricao: '',
      numeroReferencia: '',
      designacaoContrato: '',
    };
  }

  /**
   * Extração tradicional de dados (scraper)
   */
  private async extractTraditional(url: string, dataPesquisa: string): Promise<DiarioAnuncio | null> {
    if (!this.page) {
      throw new Error('Browser não inicializado.');
    }

    try {
      console.log(`[PASSO 5] A processar anúncio: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(2000);

      // Extrair o texto completo da página (apenas dados reais, não inventar)
      const pageText = (await this.page.textContent('body')) || '';

      // VERIFICAÇÃO: Procurar por 'Vocabulário Principal:' e extrair o valor
      let cpvPrincipal = '';
      const cpvMatch = pageText.match(/Vocabulário Principal:\s*(\d{8}(-\d)?)/i);
      if (cpvMatch) {
        cpvPrincipal = cpvMatch[1];
        console.log(`  Vocabulário Principal encontrado: ${cpvPrincipal}`);
      } else {
        console.log(`  ⚠ Vocabulário Principal não encontrado neste anúncio`);
        // Voltar para a página de resultados antes de retornar
        await this.returnToResultsPage();
        return null;
      }

      // Verificar se este CPV existe no array de CPV
      if (this.cpvCodes.length > 0 && !this.cpvCodes.includes(cpvPrincipal)) {
        console.log(`  ✗ CPV ${cpvPrincipal} não está na lista de referência. Ignorando...`);
        // Voltar para a página de resultados antes de retornar
        await this.returnToResultsPage();
        return null;
      }

      console.log(`  ✓ CPV ${cpvPrincipal} encontrado na lista! Recolhendo dados...`);

      // EXTRAIR CAMPOS ESSENCIAIS:
      // 1. SUMÁRIO (até encontrar TEXTO ou próximo campo)
      let sumario =
        this.extractField(pageText, /SUMÁRIO[:\s]*([^]+?)(?:TEXTO|Emissor:|$)/i) ||
        this.extractField(pageText, /SUMARIO[:\s]*([^]+?)(?:TEXTO|Emissor:|$)/i);
      sumario = sumario.replace(/TEXTO/g, '').trim();

      // 2. Publicação (Diário da República n.º X/YYYY, Série II de YYYY-MM-DD)
      let publicacao =
        this.extractField(pageText, /(Diário da República n\.º [^]+?Série II de [\d-]+)/i) ||
        this.extractField(pageText, /(Diario da Republica n\.º [^]+?Serie II de [\d-]+)/i);
      publicacao = publicacao.replace(/Emissor:.*$/i, '').trim();

      // 3. Emissor (obrigatório)
      let emissor = this.extractField(pageText, /Emissor:[\s]*([^]+?)(?:Parte:|Data de Publicação:|SUMÁRIO|$)/i);
      emissor = emissor
        .replace(/Parte:.*$/i, '')
        .replace(/Data de Publicação:.*$/i, '')
        .trim();

      // 4. Data de Publicação (obrigatório)
      let dataPublicacao = this.extractField(pageText, /Data de Publicação:[\s]*(\d{4}-\d{2}-\d{2})/i);
      if (!dataPublicacao) {
        dataPublicacao = this.extractField(pageText, /Data de Publicação:[\s]*([^]+?)(?:SUMÁRIO|SUMARIO|Vocabulário|$)/i);
        dataPublicacao = dataPublicacao
          .replace(/SUMÁRIO.*$/i, '')
          .replace(/SUMARIO.*$/i, '')
          .trim();
      }

      // Extrair dados adicionais (opcionais)
      const numeroAnuncio = this.extractField(pageText, /Anúncio de procedimento n\.º[\s]*(\d+\/\d+)/i);
      const entidadeAdjudicante = this.extractField(pageText, /Designação da entidade adjudicante:[\s]*([^\n]+)/i);
      const nipc = this.extractField(pageText, /NIPC:[\s]*(\d+)/i);
      const precoBaseSemIVA = this.extractField(pageText, /Preço base s\/IVA:[\s]*([^\n]+EUR)/i);
      const dataEnvioAnuncio = this.extractField(pageText, /Data de Envio do Anúncio:[\s]*([^\n]+)/i);
      const tipoContrato = this.extractField(pageText, /Tipo de Contrato Principal:[\s]*([^\n]+)/i);
      const numeroReferencia = this.extractField(pageText, /Número de referência interna:[\s]*([^\n]+)/i);
      const designacaoContrato = this.extractField(pageText, /Designação do contrato:[\s]*([^\n]+)/i);
      const descricao = this.extractField(pageText, /Descrição:[\s]*([^\n]+)/i);
      const numeroProcesso = this.extractField(pageText, /Tipo de Procedimento:[\s]*([^\n]+)/i);
      const distrito = this.extractField(pageText, /Distrito:[\s]*([^\n]+)/i);
      const concelho = this.extractField(pageText, /Concelho:[\s]*([^\n]+)/i);
      const localidade = this.extractField(pageText, /Localidade:[\s]*([^\n]+)/i);
      const nutIII = this.extractField(pageText, /NUT III:[\s]*([^\n]+)/i);

      // Validação: Garantir que temos pelo menos os dados obrigatórios
      if (!emissor || !dataPublicacao) {
        console.log(`  ⚠ Dados obrigatórios em falta (Emissor ou Data de Publicação). Ignorando anúncio.`);
        await this.returnToResultsPage();
        return null;
      }

      console.log(`  ✓ Dados recolhidos com sucesso:`);
      console.log(`    - SUMÁRIO: ${sumario || 'N/A'}`);
      console.log(`    - Publicação: ${publicacao || 'N/A'}`);
      console.log(`    - Emissor: ${emissor}`);
      console.log(`    - Data de Publicação: ${dataPublicacao}`);
      console.log(`    - Vocabulário Principal: ${cpvPrincipal}`);
      console.log(`    - URL: ${url}`);

      // Voltar para a página de resultados antes de retornar os dados
      await this.returnToResultsPage();

      return {
        sumario,
        publicacao,
        emissor,
        dataPublicacao,
        cpvPrincipal,
        url,
        numeroAnuncio,
        dataPesquisa,
        entidadeAdjudicante,
        nipc,
        precoBaseSemIVA,
        dataEnvioAnuncio,
        tipoContrato,
        descricao,
        numeroReferencia,
        designacaoContrato,
        numeroProcesso,
        distristo: distrito,
        concelho,
        localidade,
        nutIII,
      };
    } catch (error) {
      console.error(`Erro ao processar anúncio ${url}:`, error);
      // Voltar para a página de resultados mesmo em caso de erro
      await this.returnToResultsPage();
      return null;
    }
  }

  /**
   * Voltar para a página de resultados
   */
  private async returnToResultsPage(): Promise<void> {
    if (!this.page || !this.resultsPageUrl) {
      return;
    }

    try {
      // Verificar se já estamos na página de resultados
      const currentUrl = this.page.url();
      if (currentUrl.includes('/dr/detalhe/anuncio-procedimento/')) {
        console.log(`  ↩ A voltar para a página de resultados...`);
        await this.page.goto(this.resultsPageUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(1500);
      }
    } catch (error) {
      console.error(`  ⚠ Erro ao voltar para a página de resultados:`, error);
    }
  }

  /**
   * Extrair um campo específico do texto usando regex
   */
  private extractField(text: string, regex: RegExp): string {
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Processar todos os anúncios e retornar os que correspondem aos CPV codes
   * ORDEM CORRETA:
   * - PASSO 5: Processar anúncios da página atual
   * - PASSO 6: Se houver paginação, ir para próxima página e repetir PASSO 5
   * - Continuar até não haver mais páginas
   * @param maxResults Número máximo de anúncios a processar (0 ou undefined = sem limite)
   */
  async collectAnuncios(maxResults?: number): Promise<DiarioAnuncio[]> {
    const anuncios: DiarioAnuncio[] = [];

    // Executar Passos 1-4: Navegar para a página de anúncios
    await this.navigateToAnunciosPublicados();

    // Obter data de pesquisa
    const { day, month, year } = this.getYesterdayDate();
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    const dataPesquisa = `${year}-${paddedMonth}-${paddedDay}`;

    let pageNumber = 1;
    let totalProcessed = 0;
    const hasMaxLimit = maxResults && maxResults > 0;

    console.log(`\n[PASSOS 5 & 6] A processar anúncios página por página...`);
    if (hasMaxLimit) {
      console.log(`Limite máximo: ${maxResults} anúncios\n`);
    } else {
      console.log(`Sem limite de resultados\n`);
    }

    // Loop através de todas as páginas
    while (true) {
      console.log(`\n═══ PÁGINA ${pageNumber} ═══`);

      // Aguardar página carregar
      await this.page?.waitForTimeout(2000);

      // Screenshot da primeira página para debug
      if (pageNumber === 1) {
        await this.page?.screenshot({ path: 'debug_primeira_pagina.png', fullPage: true });
      }

      // PASSO 5: Extrair links da página atual
      console.log(`[PASSO 5] A extrair anúncios desta página...`);
      const linksNestaPagina = await this.extractCurrentPageLinks();
      console.log(`  Encontrados ${linksNestaPagina.length} anúncios nesta página\n`);

      // PASSO 5: Processar cada anúncio da página atual
      for (let i = 0; i < linksNestaPagina.length; i++) {
        // Verificar se já atingimos o limite máximo
        if (hasMaxLimit && totalProcessed >= maxResults!) {
          console.log(`\n⚠ Limite máximo de ${maxResults} anúncios atingido. Parando...`);
          break;
        }

        const link = linksNestaPagina[i];
        totalProcessed++;
        console.log(`[PASSO 5] Processando anúncio ${i + 1}/${linksNestaPagina.length} (Total: ${totalProcessed})...`);

        try {
          const anuncio = await this.extractAnuncioData(link, dataPesquisa, maxResults);
          if (anuncio) {
            anuncios.push(anuncio);
            console.log(`  ✓ Anúncio recolhido! Total de anúncios com CPV matching: ${anuncios.length}`);
          }
        } catch (error) {
          console.error(`  ✗ Erro ao processar anúncio: ${error}`);
          // Continuar com o próximo anúncio mesmo se houver erro
        }

        // Pequeno delay entre requisições
        await this.page?.waitForTimeout(1000);
      }

      // Se atingimos o limite, parar o loop de páginas
      if (hasMaxLimit && totalProcessed >= maxResults!) {
        console.log(`\nLimite de ${maxResults} anúncios atingido. Processo concluído.`);
        break;
      }

      // PASSO 6: Verificar se há próxima página
      console.log(`\n[PASSO 6] A verificar se há mais páginas...`);
      const temProximaPagina = await this.goToNextPage();

      if (!temProximaPagina) {
        console.log(`  ✓ Não há mais páginas. Processamento concluído.`);
        break;
      }

      pageNumber++;
      console.log(`  ✓ A avançar para página ${pageNumber}...`);
    }

    console.log(`\n========================================`);
    console.log(`Total de páginas processadas: ${pageNumber}`);
    console.log(`Total de anúncios processados: ${totalProcessed}`);
    console.log(`Total de anúncios com CPV matching: ${anuncios.length}`);
    console.log(`========================================`);
    return anuncios;
  }
}
