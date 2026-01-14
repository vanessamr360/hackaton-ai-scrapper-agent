# 📅 Sistema de Agendamento Automático

## Descrição

O scheduler executa automaticamente o scraping todos os dias às 9h da manhã, com fallback automático de IA para scraper manual.

## 🚀 Como Usar

### 1. Executar Agendamento Diário (9h)

```bash
npm run scheduler
```

- Agenda execução automática todos os dias às 9h
- Tenta usar IA primeiro
- Se IA falhar, usa scraper manual automaticamente
- Mantém processo rodando em background

### 2. Executar Imediatamente (com IA)

```bash
npm run scheduler:now
```

- Executa imediatamente
- Tenta IA primeiro, fallback para manual
- Processo termina após execução

### 3. Executar Scraper Manual (sem IA)

```bash
npm run scheduler:manual
```

- Força uso de scraper tradicional
- Ignora completamente a IA
- Processo termina após execução

## ⚙️ Configuração

Edite o arquivo `.env`:

```env
# Horário de execução (formato cron)
CRON_SCHEDULE=0 9 * * *     # 9h todos os dias

# Ativar/desativar IA
USE_AI=true                  # true = tenta IA, false = só manual

# Limite de resultados (opcional)
MAX_RESULTS=                 # vazio = sem limite, ou número (ex: 100)

# Pasta de resultados
RESULTS_FOLDER=./results

# Executar em modo headless
HEADLESS=true

# Configurações de Email (SMTP)
EMAIL_HOST=smtp.gmail.com           # Servidor SMTP
EMAIL_PORT=587                       # Porta SMTP (587 para TLS, 465 para SSL)
EMAIL_USER=seu-email@gmail.com      # Email remetente
EMAIL_PASS=sua-senha-de-app         # Senha de app (Gmail) ou senha normal
EMAIL_FROM="DDR Scraper <seu-email@gmail.com>"  # Nome e email do remetente
EMAIL_RECIPIENTS=dest1@exemplo.pt,dest2@exemplo.pt  # Lista de destinatários (separados por vírgula)
```

### Configuração Gmail

Para usar Gmail como servidor SMTP:

1. Ativar verificação em 2 passos: https://myaccount.google.com/security
2. Criar senha de app: https://myaccount.google.com/apppasswords
3. Usar a senha de app gerada em `EMAIL_PASS`

### Outros Provedores SMTP

- **Outlook/Hotmail**: `smtp.office365.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **SMTP próprio**: Consultar documentação do provedor

### Formato Cron

- `0 9 * * *` = Todos os dias às 9h
- `0 9 * * 1-5` = Dias úteis (seg-sex) às 9h
- `0 */6 * * *` = A cada 6 horas
- `0 9,15 * * *` = Às 9h e 15h todos os dias

## 📊 Resultados

Todos os ficheiros são guardados em `./results/`:

- **Excel**: `contratos_YYYY-MM-DDTHH-MM-SS.xlsx`
- **Log de execuções**: `execution_log.json`
- **📧 Email**: Enviado automaticamente após cada execução

### Email Automático

Após cada execução agendada, é enviado um email para os destinatários configurados contendo:

- 📊 Resumo da execução (data, modo, número de anúncios)
- 📎 Ficheiro Excel anexado (se houver resultados)
- ℹ️ Informações sobre fonte e critérios
- ✅ Estado de sucesso/falha

**Nota**: O email só é enviado se as configurações SMTP estiverem definidas no `.env`

### Estrutura do Log

```json
[
  {
    "timestamp": "2026-01-14T09:00:00.000Z",
    "mode": "IA",
    "success": true,
    "anunciosCount": 15,
    "duration": "45s",
    "error": null
  }
]
```

## 🔄 Lógica de Fallback

1. **Tentativa 1 - IA** (se `USE_AI=true`):

   - Inicializa agente de IA
   - Executa scraping com IA
   - Se encontrar anúncios → ✅ Sucesso
   - Se falhar → Prossegue para Tentativa 2

2. **Tentativa 2 - Manual**:

   - Executa scraper tradicional (sem IA)
   - Retorna resultados encontrados

3. **Resultado Final**:
   - Gera Excel com anúncios encontrados
   - Regista execução em `execution_log.json`

## 🛠️ Manutenção

### Testar Configuração de Email

Antes de usar o scheduler, teste se o email está configurado corretamente:

```bash
npm run test:email
```

Este comando:

- ✓ Verifica todas as variáveis de ambiente necessárias
- ✓ Testa a conexão SMTP
- ✓ Envia email de teste para todos os destinatários
- ✓ Confirma que tudo está funcional

### Ver Últimas Execuções

O log `execution_log.json` mantém as últimas 100 execuções com:

- Data/hora
- Modo usado (IA ou Manual)
- Sucesso/falha
- Número de anúncios
- Duração
- Mensagens de erro

### Monitorização

```bash
# Ver logs em tempo real (Windows)
Get-Content results\execution_log.json -Tail 10

# Ver ficheiros gerados
ls results\*.xlsx | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

## 🐛 Troubleshooting

### Scheduler não inicia

- Verificar `.env` configurado corretamente
- Garantir que `results/` existe ou pode ser criado

### IA sempre falha

- Verificar credenciais Azure OpenAI no `.env`
- Confirmar `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- Scraper manual será usado automaticamente como fallback

### Email não é enviado

- Executar `npm run test:email` para diagnosticar
- Verificar configurações SMTP no `.env`
- Gmail: Confirmar senha de app criada (não usar senha normal)
- Verificar firewall/antivírus não bloqueando porta SMTP
- Confirmar EMAIL_RECIPIENTS está preenchido

### Nenhum anúncio encontrado

- Normal se não houver anúncios publicados ontem
- Verificar se data está correta
- Confirmar que site está acessível

## 📝 Exemplo de Uso em Produção

### Windows (Task Scheduler)

1. Criar ficheiro `.bat`:

```batch
@echo off
cd C:\Dev\Hackaton\ddr-scrapper-agent
call npm run scheduler
```

2. Agendar no Task Scheduler para iniciar ao arranque do sistema

### Linux (systemd)

```ini
[Unit]
Description=DDR Scraper Scheduler
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/ddr-scrapper-agent
ExecStart=/usr/bin/npm run scheduler
Restart=always

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["npm", "run", "scheduler"]
```

## 🔐 Segurança

- Nunca commitiar `.env` com credenciais reais
- Usar `.env.example` como template
- Rotar chaves API periodicamente
- Limitar `MAX_RESULTS` para evitar sobrecarga
