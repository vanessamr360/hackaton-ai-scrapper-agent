# 🤖 Diagnóstico do Agente de IA

## Problema Corrigido

O agente de IA estava lançando um erro no construtor quando o Azure OpenAI não estava configurado, impedindo o fallback automático para o scraper manual.

### Correções Implementadas:

1. ✅ **Construtor não lança mais erro** - Apenas avisa quando Azure OpenAI não está configurado
2. ✅ **Método `isActive()`** - Verifica se o cliente OpenAI foi inicializado com sucesso
3. ✅ **Mensagens de log melhoradas** - Identifica claramente quando IA está ativa ou desativada
4. ✅ **Fallback automático** - Sistema muda automaticamente para scraper manual se IA não funcionar

## 🔍 Como Diagnosticar

### Teste Rápido de IA

```bash
npm run test:ai
```

Este comando verifica:

- ✓ Variáveis de ambiente configuradas
- ✓ Cliente Azure OpenAI criado com sucesso
- ✓ Agente de IA ativo
- ✓ Conexão com API funcionando (faz chamada real)

### Resultado Esperado

#### ✅ Com Azure OpenAI Configurado:

```
🔍 Diagnóstico do Agente de IA
============================================================

📋 1. Verificando variáveis de ambiente Azure OpenAI:
------------------------------------------------------------
✅ AZURE_OPENAI_ENDPOINT: https://seu-recurso.openai.azure.com
✅ AZURE_OPENAI_API_KEY: ***
✅ AZURE_OPENAI_DEPLOYMENT: gpt-4
✅ AZURE_OPENAI_API_VERSION: 2024-10-01-preview

🔧 2. Testando criação do cliente Azure OpenAI:
------------------------------------------------------------
✅ Cliente Azure OpenAI criado com sucesso

🤖 3. Testando inicialização do Agente de IA:
------------------------------------------------------------
✅ Agente de IA criado
✅ Agente de IA está ativo e pronto para usar

🌐 4. Teste de conexão com Azure OpenAI API:
------------------------------------------------------------
⚠️  Este teste faz uma chamada real à API (consome créditos)
📤 Enviando requisição de teste...
✅ API respondeu: "OK"
✅ Conexão com Azure OpenAI funcionando perfeitamente!

============================================================
✅ TODOS OS TESTES PASSARAM!
```

#### ⚠️ Sem Azure OpenAI Configurado:

```
📋 1. Verificando variáveis de ambiente Azure OpenAI:
------------------------------------------------------------
❌ AZURE_OPENAI_ENDPOINT: NÃO CONFIGURADO
❌ AZURE_OPENAI_API_KEY: NÃO CONFIGURADO
❌ AZURE_OPENAI_DEPLOYMENT: NÃO CONFIGURADO
✅ AZURE_OPENAI_API_VERSION: 2024-10-01-preview

⚠️  RESULTADO: Azure OpenAI não está completamente configurado

📝 Para ativar o Agente de IA:
   1. Copie .env.example para .env
   2. Preencha as variáveis AZURE_OPENAI_*
   3. Execute: npm run test:ai

✅ O scraper funcionará normalmente no modo MANUAL (sem IA)
```

## ⚙️ Configuração do Azure OpenAI

### 1. Obter Credenciais Azure

1. Acesse o [Azure Portal](https://portal.azure.com)
2. Navegue para seu recurso **Azure OpenAI**
3. Em **Keys and Endpoint**:
   - Copie o **Endpoint** (ex: `https://seu-recurso.openai.azure.com`)
   - Copie uma das **Keys**
4. Em **Deployments**:
   - Anote o nome do deployment (ex: `gpt-4`, `gpt-35-turbo`)

### 2. Configurar .env

Edite o arquivo `.env`:

```env
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://seu-recurso.openai.azure.com
AZURE_OPENAI_API_KEY=sua-chave-aqui
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

### 3. Testar Configuração

```bash
npm run test:ai
```

## 🚀 Modos de Execução

### Com IA (se configurado)

```bash
npm run scheduler:now
```

- Tenta usar IA primeiro
- Fallback automático para manual se falhar

### Sem IA (Forçar Manual)

```bash
npm run scheduler:manual
```

- Ignora IA completamente
- Usa apenas scraper tradicional

### Agendado (9h diárias)

```bash
npm run scheduler
```

- Usa IA se configurado, senão usa manual

## 📊 Comportamento Atual

### Fluxo de Decisão:

```
┌─────────────────────────┐
│  Iniciar Scraping       │
└────────┬────────────────┘
         │
         ▼
    useAI=true?
         │
    ┌────┴────┐
    │         │
   Sim       Não
    │         │
    ▼         │
┌──────────┐  │
│ Criar    │  │
│ Agente IA│  │
└────┬─────┘  │
     │        │
     ▼        │
 isActive()?  │
     │        │
 ┌───┴───┐    │
Sim     Não   │
 │       │    │
 ▼       │    │
┌────────┐    │
│ IA Mode│    │
│  ✅     │    │
└───┬────┘    │
    │         │
    │   ┌─────┴──────┐
    │   │            │
    ▼   ▼            ▼
┌──────────────────────┐
│  Fallback Manual     │
│  (Sempre Funciona)   │
└──────────────────────┘
```

### Logs Esperados:

#### ✅ IA Ativa:

```
A inicializar browser...
✅ Agente de IA inicializado com sucesso
🤖 Modo IA ativado (com fallback automático)
```

#### ⚠️ IA Não Configurada:

```
A inicializar browser...
⚠️ Azure OpenAI não configurado. Agente de IA desativado.
   Configure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY e AZURE_OPENAI_DEPLOYMENT no .env
⚠ Agente de IA criado mas Azure OpenAI não configurado. Usando scraper tradicional.
Carregados 48 códigos CPV para filtrar
```

#### ❌ IA Falhou Durante Execução:

```
A inicializar browser...
✅ Agente de IA inicializado com sucesso
🤖 TENTATIVA 1: Executando com Agente de IA...
❌ Falha na execução com IA: [erro]
🔄 Mudando para scraper manual...
🔧 TENTATIVA 2: Executando Scraper Manual...
```

## 🛠️ Troubleshooting

### Agente não inicializa

✅ **Agora resolvido** - O agente inicializa sempre e faz fallback automático

### IA não funciona mas quero usar manual

✅ **Funciona automaticamente** - Sistema detecta e usa manual

### Quero testar apenas IA (sem fallback)

❌ **Não recomendado** - Fallback é automático por design
💡 Use `npm run test:ai` para verificar se IA está funcionando

### Erro: "Failed to create Azure OpenAI client"

✅ **Agora só aparece como warning** - Não impede execução

## 📝 Resumo

| Comando                    | IA?                 | Fallback?     | Uso               |
| -------------------------- | ------------------- | ------------- | ----------------- |
| `npm run scheduler:now`    | ✅ (se configurado) | ✅ Automático | Execução imediata |
| `npm run scheduler:manual` | ❌ Forçado OFF      | N/A           | Apenas manual     |
| `npm run scheduler`        | ✅ (se configurado) | ✅ Automático | Agendamento 9h    |
| `npm run test:ai`          | ✅ Teste            | ❌            | Diagnóstico       |

**Recomendação**: Use sempre `scheduler:now` ou `scheduler` - o sistema é inteligente e escolhe o melhor método automaticamente.
