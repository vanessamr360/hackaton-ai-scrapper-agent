# 📚 Documentação das APIs REST

Esta documentação descreve os endpoints REST disponíveis para integração com o sistema de scraping do Diário da República.

## 🌐 URL Base

```
http://localhost:3000
```

> **Nota**: A porta pode ser configurada através da variável de ambiente `API_PORT`

---

## 📋 Índice

- [Health Check](#health-check)
- [Contratos de Ontem](#contratos-de-ontem)
- [Pesquisa Personalizada](#pesquisa-personalizada)
- [Códigos CPV](#códigos-cpv)
- [Modelos de Resposta](#modelos-de-resposta)
- [Códigos de Erro](#códigos-de-erro)
- [Exemplos de Integração](#exemplos-de-integração)

---

## 🏥 Health Check

Verifica se a API está operacional.

### Endpoint

```http
GET /health
```

### Resposta

**Status 200 OK**

```json
{
  "status": "ok",
  "message": "API a funcionar"
}
```

### Exemplo

```bash
curl http://localhost:3000/health
```

---

## 📊 Contratos de Ontem

Recolhe anúncios publicados no dia anterior (ontem) no Diário da República.

### Endpoint

```http
GET /api/contracts/yesterday
```

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `maxResults` | number | Não | Limita o número de anúncios a processar |

### Resposta

**Status 200 OK**

```json
{
  "success": true,
  "date": "2026-01-13",
  "totalContracts": 5,
  "maxResults": null,
  "cpvCodes": ["66512200-4", "66515100-0"],
  "report": {
    "filename": "anuncios_seguros_2026-01-13.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "base64": "UEsDBBQABgAIAAAAIQ..."
  },
  "contracts": [
    {
      "title": "Seguro de Acidentes de Trabalho",
      "publicacao": "Diário da República n.º 10/2026, Série II de 2026-01-13",
      "entity": "Hospital Central de Lisboa",
      "cpv": "66512200-4",
      "cpvDescription": "",
      "contractDate": "2026-01-13",
      "contractValue": "150.000,00 EUR",
      "contractNumber": "123/2026",
      "url": "https://diariodarepublica.pt/dr/..."
    }
  ]
}
```

**Status 400 Bad Request**

```json
{
  "success": false,
  "error": "maxResults deve ser um número maior que 0"
}
```

**Status 500 Internal Server Error**

```json
{
  "success": false,
  "error": "Mensagem de erro detalhada",
  "stack": "Stack trace (apenas em desenvolvimento)"
}
```

### Características

- ✅ Nunca cria ficheiros no disco
- ✅ Retorna Excel em base64
- ✅ Filtra automaticamente por 48 códigos CPV de seguros
- ✅ Suporta cancelamento de requisição (fecha browser automaticamente)
- ✅ Retorna apenas os códigos CPV encontrados nos resultados

### Exemplos

**Buscar todos os anúncios**

```bash
curl http://localhost:3000/api/contracts/yesterday
```

**Limitar a 10 resultados**

```bash
curl "http://localhost:3000/api/contracts/yesterday?maxResults=10"
```

**JavaScript/TypeScript**

```typescript
const response = await fetch('http://localhost:3000/api/contracts/yesterday?maxResults=5');
const data = await response.json();

if (data.success) {
  console.log(`Encontrados ${data.totalContracts} contratos`);
  
  // Descarregar Excel
  const excelBlob = new Blob(
    [Buffer.from(data.report.base64, 'base64')],
    { type: data.report.mimeType }
  );
  
  // Processar contratos
  data.contracts.forEach(contract => {
    console.log(`${contract.title} - ${contract.cpv}`);
  });
}
```

---

## 🔍 Pesquisa Personalizada

Permite pesquisas personalizadas com filtros de data, CPV e envio automático de email.

### Endpoint

```http
POST /api/contracts/search
```

### Request Body

```json
{
  "cpvCodes": ["66512200-4", "66515100-0"],
  "date": "2026-01-13",
  "sendEmail": true,
  "maxResults": 20
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `cpvCodes` | string[] | Não | Array de códigos CPV a filtrar (default: todos os 48 códigos) |
| `date` | string | Não | Data no formato YYYY-MM-DD (default: ontem) |
| `sendEmail` | boolean | Não | Enviar email com o relatório (default: false) |
| `maxResults` | number | Não | Limite de resultados a processar |

### Resposta

**Status 200 OK**

```json
{
  "success": true,
  "emailSuccess": true,
  "emailSendTo": ["user@example.com", "admin@example.com"],
  "date": "2026-01-13",
  "totalContracts": 15,
  "maxResults": 20,
  "cpvCodes": ["66512200-4", "66515100-0", "66516000-0"],
  "report": {
    "filename": "contratos_search_2026-01-14T10-30-00.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "base64": "UEsDBBQABgAIAAAAIQ..."
  },
  "contracts": [
    {
      "title": "Seguro de Responsabilidade Civil",
      "publicacao": "Diário da República n.º 10/2026",
      "entity": "Município de Lisboa",
      "cpv": "66516000-0",
      "cpvDescription": "",
      "contractDate": "2026-01-13",
      "contractValue": "250.000,00 EUR",
      "contractNumber": "456/2026",
      "url": "https://diariodarepublica.pt/dr/..."
    }
  ]
}
```

**Status 400 Bad Request - Data Inválida**

```json
{
  "success": false,
  "error": "Data inválida. Use formato YYYY-MM-DD"
}
```

**Status 400 Bad Request - CPV Inválido**

```json
{
  "success": false,
  "error": "Códigos CPV inválidos: 99999999-9, 88888888-8",
  "validCodes": ["66000000-0", "66512200-4", "..."]
}
```

### Características

- ✅ Validação de códigos CPV contra lista permitida
- ✅ Validação de formato de data
- ✅ Envio automático de email (opcional)
- ✅ Excel gerado em memória (sem ficheiros temporários)
- ✅ Retorna informações de envio de email

### Exemplos

**Pesquisa básica com CPV específico**

```bash
curl -X POST http://localhost:3000/api/contracts/search \
  -H "Content-Type: application/json" \
  -d '{
    "cpvCodes": ["66512200-4"],
    "date": "2026-01-13"
  }'
```

**Pesquisa com envio de email**

```bash
curl -X POST http://localhost:3000/api/contracts/search \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-01-10",
    "sendEmail": true,
    "maxResults": 50
  }'
```

**JavaScript/TypeScript**

```typescript
const response = await fetch('http://localhost:3000/api/contracts/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    cpvCodes: ['66512200-4', '66515100-0'],
    date: '2026-01-13',
    sendEmail: true,
    maxResults: 100,
  }),
});

const data = await response.json();

if (data.success) {
  console.log(`Encontrados ${data.totalContracts} contratos`);
  
  if (data.emailSuccess) {
    console.log(`Email enviado para: ${data.emailSendTo.join(', ')}`);
  }
  
  // Descarregar Excel
  const link = document.createElement('a');
  link.href = `data:${data.report.mimeType};base64,${data.report.base64}`;
  link.download = data.report.filename;
  link.click();
}
```

**Python**

```python
import requests
import base64

response = requests.post(
    'http://localhost:3000/api/contracts/search',
    json={
        'cpvCodes': ['66512200-4'],
        'date': '2026-01-13',
        'sendEmail': False,
        'maxResults': 10
    }
)

data = response.json()

if data['success']:
    print(f"Encontrados {data['totalContracts']} contratos")
    
    # Guardar Excel
    excel_bytes = base64.b64decode(data['report']['base64'])
    with open(data['report']['filename'], 'wb') as f:
        f.write(excel_bytes)
    
    # Processar contratos
    for contract in data['contracts']:
        print(f"{contract['title']} - CPV: {contract['cpv']}")
```

---

## 📋 Códigos CPV

Lista todos os códigos CPV disponíveis para filtragem.

### Endpoint

```http
GET /api/cpv-codes
```

### Resposta

**Status 200 OK**

```json
{
  "success": true,
  "cpvCodes": {
    "33100000": "Dispositivos médicos",
    "66000000-0": "Serviços financeiros e de seguros",
    "66512200-4": "Serviços de seguro de acidentes de trabalho",
    "66515100-0": "Serviços de seguro de responsabilidade civil geral",
    "66516000-0": "Serviços de seguro de responsabilidade civil profissional",
    "...": "..."
  }
}
```

### Características

- ✅ Retorna 48 códigos CPV da família de seguros
- ✅ Inclui descrições em português
- ✅ Formato de resposta otimizado para dropdowns/selects

### Exemplo

```bash
curl http://localhost:3000/api/cpv-codes
```

**JavaScript/TypeScript**

```typescript
const response = await fetch('http://localhost:3000/api/cpv-codes');
const data = await response.json();

if (data.success) {
  // Criar dropdown
  const select = document.createElement('select');
  
  Object.entries(data.cpvCodes).forEach(([code, description]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${code} - ${description}`;
    select.appendChild(option);
  });
}
```

---

## 📦 Modelos de Resposta

### Contract (Contrato)

```typescript
interface Contract {
  title: string;              // SUMÁRIO do anúncio
  publicacao: string;         // Diário da República n.º X/YYYY, Série II
  entity: string;             // Emissor/Entidade
  cpv: string;                // Código CPV
  cpvDescription: string;     // Descrição do CPV (vazio nas APIs)
  contractDate: string;       // Data de publicação (YYYY-MM-DD)
  contractValue: string;      // Preço base s/IVA
  contractNumber: string;     // Número do anúncio
  url: string;                // URL do anúncio no Diário da República
}
```

### Report (Relatório)

```typescript
interface Report {
  filename: string;           // Nome do ficheiro Excel
  mimeType: string;          // 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  base64: string;            // Conteúdo do Excel em base64
}
```

### Response (Resposta de Sucesso)

```typescript
interface ApiResponse {
  success: boolean;          // true
  date: string;              // Data da pesquisa (YYYY-MM-DD)
  totalContracts: number;    // Número total de contratos encontrados
  maxResults: number | null; // Limite aplicado (null = sem limite)
  cpvCodes: string[];        // Códigos CPV únicos encontrados nos resultados
  report: Report;            // Ficheiro Excel
  contracts: Contract[];     // Array de contratos (preview dos primeiros 10)
  
  // Apenas em /api/contracts/search
  emailSuccess?: boolean;    // Email enviado com sucesso
  emailSendTo?: string[];    // Lista de destinatários do email
}
```

### Error Response (Resposta de Erro)

```typescript
interface ErrorResponse {
  success: boolean;          // false
  error: string;             // Mensagem de erro
  stack?: string;            // Stack trace (apenas em desenvolvimento)
  validCodes?: string[];     // Códigos válidos (erro de validação CPV)
}
```

---

## ⚠️ Códigos de Erro

### HTTP 400 Bad Request

Erro de validação nos parâmetros de entrada.

**Causas comuns:**
- `maxResults` menor que 1
- Data em formato inválido (deve ser YYYY-MM-DD)
- Códigos CPV inválidos ou não suportados

### HTTP 500 Internal Server Error

Erro interno durante o processamento.

**Causas comuns:**
- Erro ao conectar ao site do Diário da República
- Timeout do browser
- Erro na geração do Excel
- Erro no envio de email (apenas se `sendEmail: true`)

---

## 🔐 Configuração e Segurança

### Variáveis de Ambiente

```bash
# API
API_PORT=3000

# Scraper
HEADLESS=true           # Browser invisível
USE_AI=false            # Usar IA (false = mais rápido)
MAX_RESULTS=           # Limite global (vazio = sem limite)

# Email (opcional)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=25
EMAIL_USER=              # Opcional para relay
EMAIL_PASS=              # Opcional para relay
EMAIL_FROM="DDR Scraper <noreply@example.com>"
EMAIL_RECIPIENTS="user1@example.com,user2@example.com"

# Armazenamento
SAVE_FILES_TO_DISK=false  # APIs nunca salvam, scheduler respeita esta flag
```

### CORS

A API permite requisições de qualquer origem (CORS habilitado). Para produção, configure origens específicas:

```typescript
app.use(cors({
  origin: ['https://seu-dominio.com', 'https://app.seu-dominio.com']
}));
```

### Rate Limiting

Recomenda-se adicionar rate limiting em produção:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo de 100 requisições por IP
});

app.use('/api/', limiter);
```

---

## 🚀 Exemplos de Integração

### Dashboard React

```tsx
import { useState } from 'react';

function ContractsDashboard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/contracts/yesterday?maxResults=20');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      } else {
        console.error(result.error);
      }
    } catch (error) {
      console.error('Erro na API:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!data?.report) return;
    
    const link = document.createElement('a');
    link.href = `data:${data.report.mimeType};base64,${data.report.base64}`;
    link.download = data.report.filename;
    link.click();
  };

  return (
    <div>
      <h1>Contratos Públicos de Seguros</h1>
      <button onClick={fetchContracts} disabled={loading}>
        {loading ? 'A carregar...' : 'Buscar Contratos de Ontem'}
      </button>
      
      {data && (
        <>
          <p>Encontrados {data.totalContracts} contratos</p>
          <button onClick={downloadExcel}>Descarregar Excel</button>
          
          <ul>
            {data.contracts.map((contract, i) => (
              <li key={i}>
                <strong>{contract.title}</strong>
                <br />
                CPV: {contract.cpv} | Valor: {contract.contractValue}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

### Webhook Integration

```typescript
// Enviar contratos para webhook externo
async function processAndSendWebhook() {
  const response = await fetch('http://localhost:3000/api/contracts/yesterday');
  const data = await response.json();

  if (data.success && data.totalContracts > 0) {
    // Enviar para sistema externo
    await fetch('https://seu-sistema.com/webhook/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: data.date,
        count: data.totalContracts,
        cpvCodes: data.cpvCodes,
        contracts: data.contracts,
        excelBase64: data.report.base64,
      }),
    });
  }
}

// Executar diariamente
setInterval(processAndSendWebhook, 24 * 60 * 60 * 1000);
```

### Power Automate / Logic Apps

```json
{
  "type": "Http",
  "inputs": {
    "method": "POST",
    "uri": "http://localhost:3000/api/contracts/search",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "cpvCodes": ["66512200-4"],
      "date": "@{formatDateTime(addDays(utcNow(), -1), 'yyyy-MM-dd')}",
      "sendEmail": true,
      "maxResults": 100
    }
  },
  "runAfter": {}
}
```

---

## 📊 Limitações e Boas Práticas

### Limitações

- **Tempo de execução**: Cada requisição pode demorar 1-5 minutos dependendo do número de anúncios
- **Cancelamento**: Se cancelar a requisição HTTP, o browser é fechado automaticamente
- **Concorrência**: Recomenda-se não executar múltiplas requisições simultâneas (compartilham recursos do browser)
- **Dados históricos**: A API acede ao site público do Diário da República, limitada à disponibilidade do site

### Boas Práticas

1. **Use `maxResults`** para testes e desenvolvimento (ex: `maxResults=5`)
2. **Implemente timeout** nas requisições (recomendado: 5-10 minutos)
3. **Cache resultados** se possível (os dados não mudam após publicação)
4. **Verifique `success: false`** antes de processar dados
5. **Use `/health`** para monitorizar disponibilidade
6. **Prefira `sendEmail: false`** nas APIs (use scheduler para emails automáticos)
7. **Valide CPV codes** contra `/api/cpv-codes` antes de enviar

---

## 🔧 Troubleshooting

### Erro: "maxResults deve ser um número maior que 0"

- Verifique se o valor é um número inteiro positivo
- Em query strings, use `?maxResults=10` (sem aspas)

### Erro: "Data inválida. Use formato YYYY-MM-DD"

- O formato deve ser exatamente `YYYY-MM-DD`
- Exemplo correto: `2026-01-13`
- Exemplos incorretos: `13-01-2026`, `2026/01/13`

### Erro: "Códigos CPV inválidos"

- Consulte `/api/cpv-codes` para ver códigos válidos
- Certifique-se de usar strings (com aspas) no JSON
- Exemplo: `["66512200-4"]` não `[66512200-4]`

### Timeout ou requisição muito lenta

- Reduza `maxResults` para testar
- Verifique se `HEADLESS=true` no .env (mais rápido)
- Verifique conectividade com diariodarepublica.pt
- Considere usar o scheduler para execuções assíncronas

### Excel vazio ou corrompido

- Verifique se `base64` não está vazio
- Teste descodificar com: `echo "BASE64" | base64 -d > test.xlsx`
- Certifique-se de usar o `mimeType` correto ao criar Blob

---

## 📞 Suporte

Para questões técnicas ou sugestões:
- Verifique os logs do servidor (stdout)
- Consulte o [README.md](README.md) para configuração completa
- Teste com `/health` antes de reportar problemas

---

**Versão da API**: 1.0.0  
**Última atualização**: Janeiro 2026
