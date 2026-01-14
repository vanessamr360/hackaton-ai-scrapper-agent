# DDR Scraper Agent

Agente automatizado para recolha diária de anúncios públicos do [Diário da República](https://diariodarepublica.pt/dr/home) com suporte a IA, APIs REST e notificações por email.

## 📋 Índice

- [Descrição](#descrição)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Utilização](#utilização)
- [APIs REST](#apis-rest)
- [Scheduler Automático](#scheduler-automático)
- [Email Notifications](#email-notifications)
- [Desenvolvimento](#desenvolvimento)

---

## 📖 Descrição

Sistema automatizado que recolhe anúncios públicos relacionados com **seguros e dispositivos médicos** do Diário da República (Série II), filtrando por códigos CPV específicos.

O sistema oferece três formas de operação:
1. **Agente de IA** - Utiliza Azure OpenAI para navegação e extração inteligente (com fallback automático)
2. **Scraper Tradicional** - Extração baseada em regras e seletores CSS
3. **APIs REST** - Endpoints HTTP para integração com outros sistemas

---

## ✨ Funcionalidades

### 🤖 Modos de Operação

- **IA com Fallback**: Tenta extração com GPT-4, reverte para scraper tradicional se falhar
- **Manual**: Usa apenas scraper tradicional (mais rápido e previsível)
- **Híbrido**: Configurável via variável de ambiente `USE_AI`

### 📊 Gestão de Dados

- Extração de 11 campos por anúncio (SUMÁRIO, Publicação, Emissor, Data, CPV, etc.)
- Filtragem por 48 códigos CPV da família de seguros (66000000-0)
- Geração de Excel com formatação profissional e descrições de CPV
- Suporte a buffer em memória (sem ficheiros temporários nas APIs)

### 🌐 APIs REST

- `GET /api/contracts/yesterday` - Anúncios de ontem
- `POST /api/contracts/search` - Pesquisa personalizada (CPVs, data, email)
- `GET /api/cpv-codes` - Lista de códigos CPV disponíveis
- `GET /health` - Health check

### ⏰ Scheduler Automático

- Execução diária às 9h (configurável)
- Tentativa IA → Fallback Manual automático
- Envio de email após cada execução
- Log de execuções (últimas 100)

### 📧 Notificações por Email

- Templates HTML profissionais
- Anexo Excel com dados completos
- Suporte SMTP com ou sem autenticação
- Configurável via variáveis de ambiente

### 🔧 Controlo de Ficheiros

- `SAVE_FILES_TO_DISK=true` - Salva Excel em `results/`
- `SAVE_FILES_TO_DISK=false` - Apenas envia por email (sem ficheiros permanentes)
- APIs nunca salvam ficheiros (apenas buffer/base64)

---

## 🏗️ Arquitetura

```
ddr-scrapper-agent/
├── src/
│   ├── config.ts              # Configurações globais
│   ├── cpv.ts                 # Códigos CPV de seguros (48 códigos)
│   ├── types.ts               # Interfaces TypeScript
│   ├── utils.ts               # Funções auxiliares
│   ├── server.ts              # Servidor REST API
│   ├── scheduler.ts           # Lógica de scheduling
│   ├── scheduler-main.ts      # CLI do scheduler
│   ├── test-ai.ts             # Teste de Azure OpenAI
│   ├── test-api.ts            # Teste de APIs REST
│   │
│   ├── openai/
│   │   ├── client.ts          # Cliente Azure OpenAI
│   │   └── agent.ts           # Agente de IA (navegação + extração)
│   │
│   ├── scrapper/
│   │   ├── diario-republica-scraper.ts    # Scraper principal
│   │   └── diario-republica-main.ts       # Script standalone
│   │
│   ├── excel/
│   │   └── excel-generator.ts # Geração de Excel com ExcelJS
│   │
│   └── email/
│       ├── email-service.ts   # Serviço SMTP (nodemailer)
│       ├── email-sender.ts    # Lógica de envio
│       └── test-email.ts      # Teste de email
│
├── results/                   # Excel gerados (se SAVE_FILES_TO_DISK=true)
└── .env                       # Variáveis de ambiente
```

### Fluxo de Execução (Scheduler)

```
Scheduler (9h diária)
    ↓
Tentativa 1: Scraper com IA
    ├─ Sucesso → Gerar Excel
    └─ Falha → Tentativa 2: Scraper Manual
         ├─ Sucesso → Gerar Excel
         └─ Falha → Log erro
              ↓
        Enviar Email
              ↓
    Salvar em disco (se SAVE_FILES_TO_DISK=true)
```

### Navegação Automática

O scraper executa automaticamente:

1. **Acesso ao site** → https://diariodarepublica.pt/dr/home
2. **Seleção Série II** → Filtro de tipo de publicação
3. **Seleção de data** → Dia anterior (ontem)
4. **Click "Anúncios publicados"** → Lista de resultados
5. **Iteração página por página**:
   - Click em cada anúncio
   - Extração de dados
   - Verificação de CPV
   - Recolha se CPV válido
6. **Paginação** → Processa todas as páginas automaticamente

---

## 🚀 Instalação

### Pré-requisitos

- Node.js v18+ (recomendado v22)
- npm ou yarn

### Passos

```bash
# 1. Clonar repositório
git clone <repo-url>
cd ddr-scrapper-agent

# 2. Instalar dependências
npm install

# 3. Instalar browsers do Playwright
npx playwright install chromium

# 4. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# 5. Compilar TypeScript
npm run build
```

---

## ⚙️ Configuração

### Ficheiro `.env`

```env
# API Server
API_PORT=3000

# Azure OpenAI (opcional - se não configurado, usa apenas scraper manual)
AZURE_OPENAI_ENDPOINT=https://seu-endpoint.openai.azure.com
AZURE_OPENAI_API_KEY=sua-chave-api
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-10-01-preview

# Browser
HEADLESS=true                    # false para ver o browser
BROWSER_TIMEOUT=30000

# Scheduler
CRON_SCHEDULE=0 9 * * *          # Cron expression (9h diária)
USE_AI=true                      # true = IA com fallback, false = só manual
MAX_RESULTS=                     # Limitar resultados (vazio = sem limite)
SAVE_FILES_TO_DISK=true          # Salvar Excel em results/ ?

# Email SMTP
EMAIL_HOST=smtp.exemplo.com
EMAIL_PORT=25                    # 25, 465, 587
EMAIL_USER=user@exemplo.com      # Opcional para relay interno
EMAIL_PASS=                      # Opcional para relay interno
EMAIL_FROM="DDR Scraper <noreply@exemplo.com>"
EMAIL_RECIPIENTS=email1@exemplo.com,email2@exemplo.com
```

### Códigos CPV

Editar [`src/cpv.ts`](src/cpv.ts) para adicionar/remover códigos CPV:

```typescript
export const CPV_CODES: string[] = [
  '66000000-0',   // Serviços financeiros e de seguros
  '66512200-4',   // Serviços de seguro de responsabilidade civil geral
  // ... adicionar mais códigos
];
```

---

## 💻 Utilização

### 1. Execução Manual

```bash
# Executar scraper com IA (fallback para manual)
npm run dev

# Apenas scraper tradicional
USE_AI=false npm run dev
```

### 2. Scheduler Automático

```bash
# Iniciar scheduler (execução diária às 9h)
npm run scheduler

# Executar agora (com IA)
npm run scheduler:now

# Executar agora (forçar manual)
npm run scheduler:manual
```

### 3. Servidor API

```bash
# Iniciar servidor REST API
npm start

# Servidor estará disponível em:
# http://localhost:3000
```

### 4. Testes

```bash
# Testar conexão Azure OpenAI
npm run test:ai

# Testar configuração de email
npm run test:email

# Testar APIs REST (servidor deve estar rodando)
npm run test:api
```

---

## 🌐 APIs REST

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Health Check
```http
GET /health
```

**Resposta:**
```json
{
  "status": "ok",
  "message": "API a funcionar"
}
```

---

#### 2. Anúncios de Ontem
```http
GET /api/contracts/yesterday?maxResults=10
```

**Query Parameters:**
- `maxResults` (opcional) - Limitar número de resultados

**Resposta:**
```json
{
  "success": true,
  "date": "2026-01-13",
  "totalContracts": 5,
  "maxResults": 10,
  "cpvCodes": ["66512200-4", "66515100-0"],
  "report": {
    "filename": "anuncios_seguros_2026-01-13.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "base64": "UEsDBBQABg..."
  },
  "contracts": [
    {
      "title": "Seguro de responsabilidade civil...",
      "publicacao": "Diário da República n.º 10/2026...",
      "entity": "Instituto Português do Desporto...",
      "cpv": "66512200-4",
      "contractDate": "2026-01-13",
      "contractNumber": "12345",
      "url": "https://diariodarepublica.pt/..."
    }
  ]
}
```

---

#### 3. Pesquisa Personalizada
```http
POST /api/contracts/search
Content-Type: application/json
```

**Body:**
```json
{
  "cpvCodes": ["66512200-4", "66515100-0"],
  "date": "2026-01-13",
  "sendEmail": true,
  "maxResults": 20
}
```

**Parâmetros:**
- `cpvCodes` (opcional) - Array de CPVs para filtrar (default: todos os 48 configurados)
- `date` (opcional) - Data no formato YYYY-MM-DD (default: ontem)
- `sendEmail` (opcional) - Enviar email com Excel anexado? (default: false)
- `maxResults` (opcional) - Limitar resultados

**Validação:**
- CPV codes inválidos retornam erro 400 com lista de códigos válidos
- Data deve estar no formato YYYY-MM-DD

**Resposta:**
```json
{
  "success": true,
  "emailSuccess": true,
  "emailSendTo": ["email1@exemplo.com"],
  "date": "2026-01-13",
  "totalContracts": 3,
  "maxResults": 20,
  "cpvCodes": ["66512200-4"],
  "report": {
    "filename": "contratos_search_2026-01-14T10-30-00.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "base64": "UEsDBBQABg..."
  },
  "contracts": [...]
}
```

---

#### 4. Códigos CPV Disponíveis
```http
GET /api/cpv-codes
```

**Resposta:**
```json
{
  "success": true,
  "cpvCodes": {
    "33100000": "Dispositivos médicos",
    "66000000-0": "Serviços financeiros e de seguros",
    "66512200-4": "Serviços de seguro de responsabilidade civil geral",
    ...
  }
}
```

---

### Cancelamento de Requisições

As APIs detectam quando o cliente cancela a requisição (Ctrl+C, timeout, etc.) e param automaticamente:
- Browser é fechado imediatamente
- Recursos são libertados
- Logs informativos indicam cancelamento

---

## ⏰ Scheduler Automático

### Configuração

No `.env`:
```env
CRON_SCHEDULE=0 9 * * *     # Diariamente às 9h
USE_AI=true                  # Tentar IA primeiro
MAX_RESULTS=                 # Sem limite
SAVE_FILES_TO_DISK=true      # Salvar em results/
```

### Comportamento

1. **Execução diária às 9h**
2. **Tentativa 1**: Scraper com IA
   - Se sucesso → Continua
   - Se falha → Tentativa 2
3. **Tentativa 2**: Scraper Manual (sempre funciona)
4. **Gerar Excel**:
   - Se `SAVE_FILES_TO_DISK=true` → Salva em `results/`
   - Se `false` → Apenas em memória para email
5. **Enviar Email** (se configurado)
6. **Registar log** em `results/execution_log.json`

### Logs de Execução

Último 100 execuções guardadas em `results/execution_log.json`:

```json
[
  {
    "timestamp": "2026-01-14T09:00:00.000Z",
    "mode": "IA",
    "success": true,
    "anunciosCount": 12,
    "duration": "45s",
    "error": null
  }
]
```

### Comandos

```bash
# Iniciar scheduler (modo daemon)
npm run scheduler

# Executar agora (com IA)
npm run scheduler:now

# Executar agora (forçar manual)
npm run scheduler:manual
```

---

## 📧 Email Notifications

### Configuração SMTP

```env
EMAIL_HOST=smtp.exemplo.com
EMAIL_PORT=25                    # 25 (relay), 465 (SSL), 587 (TLS)
EMAIL_USER=user@exemplo.com      # Opcional para relay interno
EMAIL_PASS=senha                 # Opcional para relay interno
EMAIL_FROM="DDR Scraper <noreply@exemplo.com>"
EMAIL_RECIPIENTS=email1@exemplo.com,email2@exemplo.com
```

### Tipos de Servidor SMTP Suportados

1. **Com autenticação** (Gmail, Outlook, etc.)
   ```env
   EMAIL_USER=seu@email.com
   EMAIL_PASS=sua-senha-ou-app-password
   ```

2. **Relay interno sem autenticação** (Exchange, Postfix)
   ```env
   EMAIL_USER=
   EMAIL_PASS=
   ```

3. **Relay com user mas sem password**
   ```env
   EMAIL_USER=noreply@empresa.com
   EMAIL_PASS=
   ```

### Template de Email

- **Assunto**: 📊 Relatório Diário de Anúncios - DD/MM/YYYY
- **Formato**: HTML profissional + texto simples
- **Anexo**: Excel com todos os anúncios
- **Conteúdo**:
  - Data e hora de execução
  - Modo (IA ou Manual)
  - Número de anúncios encontrados
  - Informações sobre fonte e critérios

### Testes

```bash
# Verificar configuração e enviar email de teste
npm run test:email
```

---

## 🛠️ Desenvolvimento

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev           # Executar com tsx (hot reload)
npm run build         # Compilar TypeScript → dist/
npm start            # Executar código compilado

# Scheduler
npm run scheduler         # Iniciar agendamento diário
npm run scheduler:now     # Executar agora (IA)
npm run scheduler:manual  # Executar agora (Manual)

# Testes
npm run test:ai      # Testar Azure OpenAI
npm run test:email   # Testar SMTP
npm run test:api     # Testar APIs REST
```

### Estrutura do Código

**Scraper Principal** (`src/scrapper/diario-republica-scraper.ts`):
```typescript
class DiarioRepublicaScraper {
  async init(headless: boolean, useAI: boolean): Promise<void>
  async navigateToAnunciosPublicados(): Promise<void>
  async collectAnuncios(maxResults?: number): Promise<DiarioAnuncio[]>
  async extractWithAI(url: string): Promise<DiarioAnuncio | null>
  async extractTraditional(url: string): Promise<DiarioAnuncio | null>
}
```

**Agente de IA** (`src/openai/agent.ts`):
```typescript
class AINavigationAgent {
  async getNextNavigationAction(page, goal, state): Promise<string>
  async extractStructuredData(html, goal): Promise<any>
  isActive(): boolean
}
```

**Excel Generator** (`src/excel/excel-generator.ts`):
```typescript
class DiarioExcelGenerator {
  async generateExcel(anuncios: DiarioAnuncio[]): Promise<Buffer>
  async generateSimpleExcel(contracts): Promise<Buffer>
  async generateSummaryExcel(anuncios, fileName): Promise<string>
}
```

### Debug

```bash
# Ver browser durante execução
HEADLESS=false npm run dev

# Limitar resultados para testes rápidos
MAX_RESULTS=3 npm run dev

# Desativar IA
USE_AI=false npm run dev
```

### Adicionar Novos CPV Codes

1. Editar `src/cpv.ts`
2. Adicionar código à array `CPV_CODES`
3. Adicionar descrição ao objeto `CPV_CODES_LABELS`
4. Recompilar: `npm run build`

```typescript
export const CPV_CODES: string[] = [
  '66000000-0',
  '99999999-9',  // Novo código
];

export const CPV_CODES_LABELS: Record<string, string> = {
  '66000000-0': 'Serviços financeiros e de seguros',
  '99999999-9': 'Descrição do novo código',
};
```

---

## 📊 Campos Extraídos

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `cpvPrincipal` | ✅ | Código CPV (Vocabulário Principal) |
| `sumario` | ✅ | Resumo do anúncio |
| `publicacao` | ✅ | Referência do Diário da República |
| `emissor` | ✅ | Entidade emissora |
| `dataPublicacao` | ✅ | Data de publicação |
| `url` | ✅ | URL completo do anúncio |
| `numeroAnuncio` | ❌ | Número de referência |
| `entidadeAdjudicante` | ❌ | Entidade que adjudica |
| `precoBaseSemIVA` | ❌ | Valor do contrato |
| `nipc` | ❌ | NIPC da entidade |
| `tipoContrato` | ❌ | Tipo de procedimento |

---

## 📝 Notas Importantes

### Limitações

- **Sem invenção de dados**: O scraper nunca inventa informação, apenas extrai o que existe
- **Dependente do site**: Mudanças no HTML do Diário da República podem quebrar o scraper
- **Rate limiting**: O site pode bloquear IPs com muitas requisições
- **Azure OpenAI**: Custos associados ao uso da API

### Boas Práticas

- ✅ Usar `MAX_RESULTS` durante desenvolvimento/testes
- ✅ Configurar `HEADLESS=false` para debug visual
- ✅ Manter `SAVE_FILES_TO_DISK=true` no scheduler (histórico)
- ✅ Configurar `SAVE_FILES_TO_DISK=false` nas APIs (economia de espaço)
- ✅ Monitorizar logs de execução regularmente
- ✅ Backup da pasta `results/` periodicamente

### Troubleshooting

**Scraper não encontra anúncios:**
- Verificar se há anúncios publicados para a data
- Confirmar que os CPV codes estão corretos
- Ver browser com `HEADLESS=false`

**Azure OpenAI não funciona:**
- Verificar credenciais no `.env`
- Executar `npm run test:ai`
- O sistema reverte automaticamente para scraper manual

**Email não enviado:**
- Executar `npm run test:email`
- Verificar configurações SMTP
- Para Gmail, usar App Passwords

**APIs retornam erro:**
- Verificar se servidor está rodando (`npm start`)
- Testar health endpoint: `curl http://localhost:3000/health`

---

## 📜 Licença

[Especificar licença]

---

## 👥 Contribuidores

[Lista de contribuidores]

---

## 📞 Suporte

Para questões ou problemas, criar issue no repositório ou contactar [email/contacto].
