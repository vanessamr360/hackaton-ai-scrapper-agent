import { config } from '../config.js';
import { createOpenAIClient } from './client.js';
import { AINavigationAgent } from './agent.js';

/**
 * Script para diagnosticar configuração do Azure OpenAI e Agente de IA
 *
 * Uso:
 *   npm run test:ai
 */

console.log('🔍 Diagnóstico do Agente de IA\n');
console.log('='.repeat(60));

// 1. Verificar variáveis de ambiente
console.log('\n📋 1. Verificando variáveis de ambiente Azure OpenAI:');
console.log('-'.repeat(60));

const requiredVars = {
  AZURE_OPENAI_ENDPOINT: config.azure.endpoint,
  AZURE_OPENAI_API_KEY: config.azure.apiKey,
  AZURE_OPENAI_DEPLOYMENT: config.azure.deployment,
  AZURE_OPENAI_API_VERSION: config.azure.apiVersion,
};

console.log(requiredVars);

let allConfigured = true;
for (const [varName, value] of Object.entries(requiredVars)) {
  if (!value || value === '') {
    console.log(`❌ ${varName}: NÃO CONFIGURADO`);
    allConfigured = false;
  } else {
    // Ocultar API key
    const displayValue = varName === 'AZURE_OPENAI_API_KEY' ? '***' : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
}

if (!allConfigured) {
  console.log('\n⚠️  RESULTADO: Azure OpenAI não está completamente configurado');
  console.log('\n📝 Para ativar o Agente de IA:');
  console.log('   1. Copie .env.example para .env (se ainda não fez)');
  console.log('   2. Preencha as seguintes variáveis:');
  console.log('      - AZURE_OPENAI_ENDPOINT=https://seu-recurso.openai.azure.com');
  console.log('      - AZURE_OPENAI_API_KEY=sua-chave-api');
  console.log('      - AZURE_OPENAI_DEPLOYMENT=nome-do-seu-deployment');
  console.log('\n   3. Execute este teste novamente: npm run test:ai');
  console.log('\n✅ O scraper funcionará normalmente no modo MANUAL (sem IA)');
  process.exit(0);
}

// 2. Testar criação do cliente OpenAI
console.log('\n🔧 2. Testando criação do cliente Azure OpenAI:');
console.log('-'.repeat(60));

try {
  const client = createOpenAIClient();
  if (client) {
    console.log('✅ Cliente Azure OpenAI criado com sucesso');
  } else {
    console.log('❌ Falha ao criar cliente (retornou null)');
    process.exit(1);
  }
} catch (error: any) {
  console.log('❌ Erro ao criar cliente:', error.message);
  process.exit(1);
}

// 3. Testar inicialização do agente
console.log('\n🤖 3. Testando inicialização do Agente de IA:');
console.log('-'.repeat(60));

try {
  const agent = new AINavigationAgent();
  console.log('✅ Agente de IA criado');

  if (agent.isActive()) {
    console.log('✅ Agente de IA está ativo e pronto para usar');
  } else {
    console.log('❌ Agente de IA criado mas não está ativo');
    process.exit(1);
  }
} catch (error: any) {
  console.log('❌ Erro ao criar agente:', error.message);
  process.exit(1);
}

// 4. Testar chamada à API (opcional - requer créditos)
console.log('\n🌐 4. Teste de conexão com Azure OpenAI API:');
console.log('-'.repeat(60));
console.log('⚠️  Este teste faz uma chamada real à API (consome créditos)');
console.log('   Pressione Ctrl+C para cancelar nos próximos 3 segundos...\n');

await new Promise((resolve) => setTimeout(resolve, 3000));

try {
  const client = createOpenAIClient();
  if (!client) {
    console.log('❌ Cliente não disponível');
    process.exit(1);
  }

  console.log('📤 Enviando requisição de teste...');

  const response = await client.chat.completions.create({
    model: config.azure.deployment,
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente útil.',
      },
      {
        role: 'user',
        content: 'Responda apenas com "OK" se recebeu esta mensagem.',
      },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  console.log(`✅ API respondeu: "${content}"`);
  console.log('✅ Conexão com Azure OpenAI funcionando perfeitamente!');
} catch (error: any) {
  console.log('❌ Erro ao chamar API:', error.message);
  console.log('\n💡 Possíveis causas:');
  console.log('   - API Key inválida');
  console.log('   - Deployment name incorreto');
  console.log('   - Endpoint incorreto');
  console.log('   - Quota/créditos esgotados');
  console.log('   - Firewall bloqueando conexão');
  process.exit(1);
}

// Resultado final
console.log('\n' + '='.repeat(60));
console.log('✅ TODOS OS TESTES PASSARAM!');
console.log('');
console.log('🎉 O Agente de IA está configurado e funcionando corretamente.');
console.log('   Pode usar: npm run scheduler:now (com IA)');
console.log('');
console.log('💡 Lembre-se:');
console.log('   - Cada execução com IA consome créditos da Azure');
console.log('   - Se a IA falhar, o fallback manual é ativado automaticamente');
console.log('   - Para forçar modo manual: npm run scheduler:manual');
console.log('');
