import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailAttachment {
  filename: string;
  path: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      const transportConfig: any = {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
      };

      // Adicionar autenticação apenas se fornecida
      if (this.config.auth) {
        transportConfig.auth = {
          user: this.config.auth.user,
          pass: this.config.auth.pass,
        };
      }

      this.transporter = nodemailer.createTransport(transportConfig);

      console.log('✓ Serviço de email inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de email:', error);
      this.transporter = null;
    }
  }

  /**
   * Enviar email com Excel de anúncios usando buffer
   */
  async sendScrapingReportWithBuffer(
    recipients: string[],
    excelBuffer: Buffer | null,
    fileName: string,
    anunciosCount: number,
    mode: string,
    executionDate: Date
  ): Promise<boolean> {
    if (!this.transporter) {
      console.error('❌ Transporter de email não inicializado');
      return false;
    }

    try {
      const dateStr = executionDate.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = executionDate.toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const subject = `📊 Relatório Diário de Anúncios - ${dateStr}`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066CC; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .stats { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0066CC; }
    .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
    .badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
    .badge-ia { background-color: #4CAF50; color: white; }
    .badge-manual { background-color: #FF9800; color: white; }
    .highlight { font-size: 24px; font-weight: bold; color: #0066CC; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Diário da República</h1>
      <p>Relatório Automático de Anúncios de Seguros</p>
    </div>
    
    <div class="content">
      <h2>Resumo da Execução</h2>
      
      <div class="stats">
        <p><strong>📅 Data de Execução:</strong> ${dateStr} às ${timeStr}</p>
        <p><strong>🤖 Modo de Extração:</strong> <span class="badge ${mode === 'IA' ? 'badge-ia' : 'badge-manual'}">${mode}</span></p>
        <p><strong>📊 Anúncios Encontrados:</strong> <span class="highlight">${anunciosCount}</span></p>
      </div>

      ${
        anunciosCount > 0
          ? `
      <h3>✅ Resultado</h3>
      <p>Foram encontrados <strong>${anunciosCount} anúncio(s)</strong> de seguros publicados no Diário da República.</p>
      <p>Os dados completos estão disponíveis no ficheiro Excel anexado.</p>
      `
          : `
      <h3>⚠️ Sem Resultados</h3>
      <p>Não foram encontrados anúncios de seguros para o período pesquisado.</p>
      `
      }

      ${
        excelBuffer
          ? `<h3>📎 Anexos</h3>
      <p>📄 <strong>${fileName}</strong></p>`
          : ''
      }

      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">

      <h3>ℹ️ Informações</h3>
      <ul>
        <li><strong>Fonte:</strong> Diário da República - Série II</li>
        <li><strong>Período:</strong> Dia anterior à execução</li>
        <li><strong>Automação:</strong> ${mode === 'IA' ? 'Agente de IA com fallback manual' : 'Scraper tradicional'}</li>
      </ul>
    </div>

    <div class="footer">
      <p>Este é um email automático gerado pelo sistema de scraping DDR.</p>
      <p>Por favor não responda a este email.</p>
    </div>
  </div>
</body>
</html>
      `;

      const textContent = `
RELATÓRIO DIÁRIO DE ANÚNCIOS - DIÁRIO DA REPÚBLICA
========================================================

📅 Data de Execução: ${dateStr} às ${timeStr}
🤖 Modo de Extração: ${mode}
📊 Anúncios Encontrados: ${anunciosCount}

${anunciosCount > 0 ? `✅ Foram encontrados ${anunciosCount} anúncio(s) de seguros.` : '⚠️ Não foram encontrados anúncios para o período pesquisado.'}

${excelBuffer ? `Os dados completos estão disponíveis no ficheiro Excel anexado: ${fileName}` : ''}

ℹ️ Informações:
- Fonte: Diário da República - Série II
- Critério: Códigos CPV da família 66000000-0 (Seguros)
- Período: Dia anterior à execução

---
Este é um email automático. Por favor não responda.
      `;

      const mailOptions: any = {
        from: this.config.from,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent,
      };

      // Adicionar anexo apenas se houver buffer
      if (excelBuffer && excelBuffer.length > 0) {
        mailOptions.attachments = [
          {
            filename: fileName,
            content: excelBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ];
      }

      console.log(`📧 A enviar email para ${recipients.length} destinatário(s)...`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado com sucesso! ID: ${info.messageId}`);

      return true;
    } catch (error: any) {
      console.error('❌ Erro ao enviar email:', error.message);
      return false;
    }
  }

  /**
   * Enviar email com Excel de anúncios
   */
  async sendScrapingReport(recipients: string[], excelPath: string, anunciosCount: number, mode: string, executionDate: Date): Promise<boolean> {
    if (!this.transporter) {
      console.error('❌ Transporter de email não inicializado');
      return false;
    }

    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Ficheiro Excel não encontrado: ${excelPath}`);
      return false;
    }

    try {
      const fileName = path.basename(excelPath);
      const dateStr = executionDate.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = executionDate.toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const subject = `📊 Relatório Diário de Anúncios - ${dateStr}`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066CC; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .stats { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0066CC; }
    .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
    .badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
    .badge-ia { background-color: #4CAF50; color: white; }
    .badge-manual { background-color: #FF9800; color: white; }
    .highlight { font-size: 24px; font-weight: bold; color: #0066CC; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Diário da República</h1>
      <p>Relatório Automático de Anúncios de Seguros</p>
    </div>
    
    <div class="content">
      <h2>Resumo da Execução</h2>
      
      <div class="stats">
        <p><strong>📅 Data de Execução:</strong> ${dateStr} às ${timeStr}</p>
        <p><strong>🤖 Modo de Extração:</strong> <span class="badge ${mode === 'IA' ? 'badge-ia' : 'badge-manual'}">${mode}</span></p>
        <p><strong>📊 Anúncios Encontrados:</strong> <span class="highlight">${anunciosCount}</span></p>
      </div>

      ${
        anunciosCount > 0
          ? `
      <h3>✅ Resultado</h3>
      <p>Foram encontrados <strong>${anunciosCount} anúncio(s)</strong> de seguros publicados no Diário da República.</p>
      <p>Os dados completos estão disponíveis no ficheiro Excel anexado.</p>
      `
          : `
      <h3>⚠️ Sem Resultados</h3>
      <p>Não foram encontrados anúncios de seguros para o período pesquisado.</p>
      `
      }

      <h3>📎 Anexos</h3>
      <p>📄 <strong>${fileName}</strong></p>

      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">

      <h3>ℹ️ Informações</h3>
      <ul>
        <li><strong>Fonte:</strong> Diário da República - Série II</li>
        <li><strong>Critério:</strong> Anúncios com códigos CPV da família 66000000-0 (Seguros)</li>
        <li><strong>Período:</strong> Dia anterior à execução</li>
        <li><strong>Automação:</strong> ${mode === 'IA' ? 'Agente de IA com fallback manual' : 'Scraper tradicional'}</li>
      </ul>
    </div>

    <div class="footer">
      <p>Este é um email automático gerado pelo sistema de scraping DDR.</p>
      <p>Por favor não responda a este email.</p>
    </div>
  </div>
</body>
</html>
      `;

      const textContent = `
RELATÓRIO DIÁRIO DE ANÚNCIOS - DIÁRIO DA REPÚBLICA
========================================================

📅 Data de Execução: ${dateStr} às ${timeStr}
🤖 Modo de Extração: ${mode}
📊 Anúncios Encontrados: ${anunciosCount}

${anunciosCount > 0 ? `✅ Foram encontrados ${anunciosCount} anúncio(s) de seguros.` : '⚠️ Não foram encontrados anúncios para o período pesquisado.'}

Os dados completos estão disponíveis no ficheiro Excel anexado: ${fileName}

ℹ️ Informações:
- Fonte: Diário da República - Série II
- Critério: Códigos CPV da família 66000000-0 (Seguros)
- Período: Dia anterior à execução

---
Este é um email automático. Por favor não responda.
      `;

      const mailOptions = {
        from: this.config.from,
        to: recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent,
        attachments: [
          {
            filename: fileName,
            path: excelPath,
          },
        ],
      };

      console.log(`📧 A enviar email para ${recipients.length} destinatário(s)...`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado com sucesso! ID: ${info.messageId}`);

      return true;
    } catch (error: any) {
      console.error('❌ Erro ao enviar email:', error.message);
      return false;
    }
  }

  /**
   * Verificar configuração de email
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      console.error('❌ Transporter não inicializado');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Conexão SMTP verificada com sucesso');
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao verificar conexão SMTP:', error.message);
      return false;
    }
  }

  /**
   * Enviar email de teste
   */
  async sendTestEmail(recipient: string): Promise<boolean> {
    if (!this.transporter) {
      console.error('❌ Transporter não inicializado');
      return false;
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: recipient,
        subject: '🧪 Email de Teste - DDR Scraper',
        text: 'Este é um email de teste do sistema de scraping DDR. Se recebeu este email, a configuração está correta!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>🧪 Email de Teste</h2>
            <p>Este é um email de teste do sistema de scraping DDR.</p>
            <p><strong>✅ Se recebeu este email, a configuração está correta!</strong></p>
            <hr>
            <p style="font-size: 12px; color: #666;">Sistema: DDR Scraper | Data: ${new Date().toLocaleString('pt-PT')}</p>
          </div>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de teste enviado! ID: ${info.messageId}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao enviar email de teste:', error.message);
      return false;
    }
  }
}

/**
 * Criar serviço de email a partir de variáveis de ambiente
 */
export function createEmailServiceFromEnv(): EmailService | null {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !port || !from) {
    console.log('⚠️ Configurações essenciais de email não definidas (HOST, PORT, FROM). Envio de email desativado.');
    return null;
  }

  const config: EmailConfig = {
    host,
    port: parseInt(port),
    secure: port === '465',
    from,
  };

  // Adicionar autenticação apenas se user estiver definido
  if (user) {
    config.auth = {
      user,
      pass: pass || '', // Pass pode ser vazio para servidores sem autenticação
    };
  }

  return new EmailService(config);
}

/**
 * Obter lista de destinatários do .env
 */
export function getEmailRecipients(): string[] {
  const recipients = process.env.EMAIL_RECIPIENTS;

  if (!recipients) {
    console.log('⚠️ Lista de destinatários (EMAIL_RECIPIENTS) não definida.');
    return [];
  }

  // Suporta separação por vírgula ou ponto-e-vírgula
  return recipients
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}
