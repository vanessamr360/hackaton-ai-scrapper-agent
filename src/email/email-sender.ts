import { createEmailServiceFromEnv, getEmailRecipients } from './email-service.js';

/**
 * Resultado da operação de envio de email
 */
export interface EmailSendResult {
  sent: boolean;
  recipientsCount: number;
  message: string;
}

/**
 * Envia relatório de scraping por email
 * @param excelBuffer Buffer do Excel ou null se não houver resultados
 * @param fileName Nome do ficheiro Excel
 * @param anunciosCount Número de anúncios encontrados
 * @param mode Modo de execução ('IA' ou 'Manual')
 * @param startTime Data/hora de início da execução
 */
export async function sendScrapingEmail(
  excelBuffer: Buffer | null,
  fileName: string,
  anunciosCount: number,
  mode: string,
  startTime: Date
): Promise<EmailSendResult> {
  const emailService = createEmailServiceFromEnv();
  const recipients = getEmailRecipients();

  // Verificar se o envio de email está configurado
  if (!emailService) {
    return {
      sent: false,
      recipientsCount: 0,
      message: 'Envio de email desativado: configurações não definidas',
    };
  }

  if (recipients.length === 0) {
    return {
      sent: false,
      recipientsCount: 0,
      message: 'Envio de email desativado: nenhum destinatário configurado',
    };
  }

  // Caso 1: Existe buffer Excel com resultados
  if (excelBuffer && excelBuffer.length > 0) {
    const emailSent = await emailService.sendScrapingReportWithBuffer(recipients, excelBuffer, fileName, anunciosCount, mode, startTime);

    return {
      sent: emailSent,
      recipientsCount: recipients.length,
      message: emailSent ? `Email enviado com sucesso para ${recipients.length} destinatário(s)` : 'Falha ao enviar email',
    };
  }

  // Caso 2: Não há resultados - enviar notificação sem anexo
  if (anunciosCount === 0) {
    const emailSent = await emailService.sendScrapingReportWithBuffer(recipients, null, 'sem_resultados.txt', 0, mode, startTime);

    return {
      sent: emailSent,
      recipientsCount: recipients.length,
      message: emailSent ? 'Notificação de execução sem resultados enviada' : 'Falha ao enviar notificação',
    };
  }

  // Caso 3: Situação inesperada (não deveria acontecer)
  return {
    sent: false,
    recipientsCount: recipients.length,
    message: 'Situação inesperada: sem buffer Excel e sem resultados',
  };
}
