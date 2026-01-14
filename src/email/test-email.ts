import { createEmailServiceFromEnv, getEmailRecipients } from './email-service.js';

/**
 * Script para testar a configuração de email
 *
 * Uso:
 *   npm run test:email
 */

async function testEmail() {
  console.log('🧪 Testando Configuração de Email\n');
  console.log('='.repeat(50));

  // Verificar variáveis de ambiente
  console.log('\n📋 Verificando variáveis de ambiente...');
  const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'EMAIL_RECIPIENTS'];

  let allConfigured = true;
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName}: não configurado`);
      allConfigured = false;
    } else {
      // Ocultar senha
      const displayValue = varName === 'EMAIL_PASS' ? '***' : varName === 'EMAIL_USER' ? value : value.substring(0, 30) + '...';
      console.log(`✓ ${varName}: ${displayValue}`);
    }
  }

  if (!allConfigured) {
    console.log('\n❌ Configure todas as variáveis de ambiente no ficheiro .env antes de executar o teste.');
    console.log('   Copie .env.example para .env e preencha os valores.');
    process.exit(1);
  }

  // Criar serviço de email
  console.log('\n🔧 Inicializando serviço de email...');
  const emailService = createEmailServiceFromEnv();

  if (!emailService) {
    console.log('❌ Falha ao criar serviço de email');
    process.exit(1);
  }

  // Verificar conexão SMTP
  console.log('\n🔌 Verificando conexão SMTP...');
  const connectionOk = await emailService.verifyConnection();

  if (!connectionOk) {
    console.log('\n❌ Falha na conexão SMTP. Verifique:');
    console.log('   - Host e porta corretos');
    console.log('   - Credenciais válidas');
    console.log('   - Firewall/antivírus não bloqueando');
    console.log('   - Se usar Gmail: ativar "Senhas de app" em https://myaccount.google.com/apppasswords');
    process.exit(1);
  }

  // Obter destinatários
  console.log('\n📧 Obtendo destinatários...');
  const recipients = getEmailRecipients();

  if (recipients.length === 0) {
    console.log('❌ Nenhum destinatário configurado em EMAIL_RECIPIENTS');
    process.exit(1);
  }

  console.log(`✓ ${recipients.length} destinatário(s) configurado(s):`);
  recipients.forEach((email: string, index: number) => {
    console.log(`   ${index + 1}. ${email}`);
  });

  // Enviar email de teste
  console.log('\n📤 Enviando email de teste...');
  console.log('   (Isto pode demorar alguns segundos)');

  for (const recipient of recipients) {
    console.log(`\n   → Enviando para ${recipient}...`);
    const sent = await emailService.sendTestEmail(recipient);

    if (sent) {
      console.log(`   ✅ Email enviado com sucesso para ${recipient}`);
    } else {
      console.log(`   ❌ Falha ao enviar para ${recipient}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Teste de email concluído!');
  console.log('\n💡 Dica: Verifique a caixa de entrada (e spam) dos destinatários.');
  console.log('');
}

// Executar teste
testEmail().catch((error) => {
  console.error('\n❌ Erro durante teste de email:', error);
  process.exit(1);
});
