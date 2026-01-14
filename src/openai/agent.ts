import { AzureOpenAI } from 'openai';
import { createOpenAIClient } from './client.js';
import { Page } from 'playwright';
import { config } from '../config.js';

const websiteName = config.websiteName;

interface AINavigationStep {
  action: string;
  selector?: string;
  value?: string;
  reasoning: string;
}

export class AINavigationAgent {
  private client: AzureOpenAI | null = null;
  private conversationHistory: any[] = [];

  constructor() {
    this.initializeAzureOpenAI();
  }

  private initializeAzureOpenAI(): void {
    console.log('🔧 Inicializando Agente de IA com Azure OpenAI...');
    this.client = createOpenAIClient();
    if (!this.client) {
      console.log('⚠️ Azure OpenAI não configurado. Agente de IA desativado.');
      console.log('   Configure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY e AZURE_OPENAI_DEPLOYMENT no .env');
    }
  }

  /**
   * Verificar se o agente de IA está ativo (cliente configurado)
   */
  isActive(): boolean {
    return this.client !== null;
  }

  /**
   * Usar IA para determinar próxima ação de navegação
   */
  async getNextNavigationAction(page: Page, goal: string, currentState: string, maxResults?: number): Promise<AINavigationStep | null> {
    if (!this.client) {
      console.log('ℹ️ Usando navegação sem IA');
      return null;
    }

    try {
      // Obter contexto da página
      const pageTitle = await page.title();
      const url = page.url();

      // Criar prompt para o GPT-4
      const maxResultsInfo = maxResults
        ? `
            LIMITE: Processar no máximo ${maxResults} anúncios`
        : '';

      const prompt = `
            Você é um agente de automação de browser para o portal ${websiteName} (Portugal).

            OBJETIVO: ${goal}${maxResultsInfo}

            ESTADO ATUAL:
            - URL: ${url}
            - Título: ${pageTitle}
            - Contexto: ${currentState}

            PASSOS ESPECÍFICOS A SEGUIR:
            1. Entrar no site https://diariodarepublica.pt/dr/home
            2. Selecionar 'Série II'
            3. Selecionar o dia de ontem no calendário
            4. Clicar em 'Anúncios publicados'
            5. Para cada resultado:
               - Clicar no anúncio
               - Verificar se o valor após 'Vocabulário Principal:' existe no array de CPV
               - Se existir, recolher: URL, Emissor, Data de Publicação, Vocabulário Principal${
                 maxResults
                   ? `
               - PARAR após processar ${maxResults} anúncios`
                   : ''
               }
            6. Processar todos os resultados (incluindo paginação)${maxResults ? ` até atingir o limite de ${maxResults} anúncios` : ''}

            REGRAS IMPORTANTES:
            - Extrair APENAS dados que existem no website, NÃO inventar informação
            - Verificar paginação e processar todas as páginas

            INSTRUÇÕES:
            1. Analise o estado atual da página
            2. Determine a próxima ação necessária seguindo os passos acima
            3. Responda APENAS em JSON com este formato:
            {
            "action": "navigate|click|fill|extract|wait|complete",
            "selector": "seletor CSS se aplicável",
            "value": "valor a preencher se aplicável",
            "reasoning": "explicação da ação"
            }
 
            AÇÕES POSSÍVEIS:
            - navigate: Ir para URL
            - click: Clicar em elemento
            - fill: Preencher campo
            - extract: Extrair dados (apenas existentes, não inventar)
            - wait: Aguardar carregamento
            - complete: Objetivo atingido

            Responda apenas com o JSON, sem explicações adicionais.
        `;

      const response = await this.client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em automação web para portais governamentais portugueses.',
          },
          ...this.conversationHistory,
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      // Parse resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const step = JSON.parse(jsonMatch[0]) as AINavigationStep;

        // Adicionar ao histórico
        this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: content });

        console.log(`🤖 IA sugere: ${step.action} - ${step.reasoning}`);
        return step;
      }

      return null;
    } catch (error: any) {
      console.error('❌ Erro ao consultar IA:', error.message);
      return null;
    }
  }
  /**
   * Usar IA para extrair dados estruturados do HTML
   */
  async extractStructuredData(htmlContent: string, goal: string, maxResults?: number): Promise<any[]> {
    if (!this.client) {
      console.log('ℹ️ Extração sem IA');
      return [];
    }

    try {
      const maxResultsInfo = maxResults
        ? `
        LIMITE: Extrair no máximo ${maxResults} anúncios`
        : '';

      const prompt = `
        Você é um especialista em extração de dados de páginas web do Diário da República.

        OBJETIVO: ${goal}${maxResultsInfo}

        HTML DA PÁGINA (truncado):
        ${htmlContent.substring(0, 5000)}

        TAREFA:
        Extrair os dados dos anúncios públicos desta página e retornar em formato JSON.
        
        REGRA CRÍTICA: Extraia APENAS dados que existem explicitamente no HTML fornecido.
        NÃO invente, NÃO adivinhe, NÃO preencha valores que não estão presentes.

        FORMATO DE SAÍDA (JSON Array):
        [
        {
            "emissor": "valor do campo Emissor (se existir)",
            "dataPublicacao": "valor do campo Data de Publicação (se existir)",
            "vocabularioPrincipal": "valor do campo Vocabulário Principal (se existir)",
            "entidadeAdjudicante": "entidade adjudicante (se existir)",
            "cpv": "código CPV (se existir)",
            "url": "URL para detalhes"
        }
        ]

        Se um campo não existir no HTML, deixe-o vazio ("") ou omita-o.
        Se não encontrar anúncios, retorne [].
        Responda apenas com o JSON, sem explicações.
        `;

      const response = await this.client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em extração de dados estruturados de HTML.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      // Parse resposta
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        console.log(`🤖 IA extraiu ${data.length} contratos`);
        return data;
      }

      return [];
    } catch (error: any) {
      console.error('❌ Erro ao extrair dados com IA:', error.message);
      return [];
    }
  }

  /**
   * Limpar histórico de conversação
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}
