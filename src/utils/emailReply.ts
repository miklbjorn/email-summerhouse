/**
 * Email reply utilities
 */

import { createMimeMessage } from 'mimetext';
import { EmailMessage } from 'cloudflare:email';
import type { InvoiceExtraction } from './ai-processing';

/**
 * Generate a reply email with invoice summary
 */
export function generateReplyEmail(
  originalMessageId: string | null,
  originalFrom: string,
  extraction: InvoiceExtraction
): EmailMessage {
  const msg = createMimeMessage();
  
  if (originalMessageId) {
    msg.setHeader('In-Reply-To', originalMessageId);
  }
  
  msg.setSender({
    name: 'Invoice Processing System',
    addr: 'bjoerkelund@mikkelbjoern.com',
  });
  msg.setRecipient(originalFrom);
  msg.setSubject('Invoice Processed Successfully');
  
  const summaryText = generateSummaryText(extraction);
  
  msg.addMessage({
    contentType: 'text/plain',
    data: summaryText,
  });

  const replyMessage = new EmailMessage(
    'bjoerkelund@mikkelbjoern.com',
    originalFrom,
    msg.asRaw()
  );

  return replyMessage;
}

/**
 * Generate human-readable summary text
 */
function generateSummaryText(extraction: InvoiceExtraction): string {
  const itemsList =
    extraction.items.length > 0
      ? extraction.items.map((item, i) => `  ${i + 1}. ${item}`).join('\n')
      : '  (No items specified)';

  const amountFormatted = extraction.amount
    ? new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: 'DKK',
      }).format(extraction.amount)
    : 'Ikke angivet';

  const paymentDateText = extraction.lastPaymentDate
    ? `Last Payment Date: ${extraction.lastPaymentDate}`
    : 'Last Payment Date: Not specified';

  // Format account information
  const accountParts: string[] = [];
  if (extraction.accountIBAN) accountParts.push(`IBAN: ${extraction.accountIBAN}`);
  if (extraction.accountBIC) accountParts.push(`BIC: ${extraction.accountBIC}`);
  if (extraction.accountREG) accountParts.push(`REG: ${extraction.accountREG}`);
  if (extraction.accountNumber) accountParts.push(`Kontonummer: ${extraction.accountNumber}`);
  const accountInfo = accountParts.length > 0
    ? accountParts.join(', ')
    : 'Ikke angivet';

  return `Tak for din faktura!

Jeg har behandlet din faktura og ekstraheret følgende information:

📋 Faktura Detaljer:
- Faktura ID: ${extraction.invoiceId || 'Ikke angivet'}
- Leverandør: ${extraction.supplier || 'Ikke angivet'}
- Beløb: ${amountFormatted}
- Betalingskonto: ${accountInfo}
- ${paymentDateText}
- Kildefil: ${extraction.sourceFileReference || 'Ikke angivet'}

📦 Dækkede Varer/Tjenester:
${itemsList}

Fakturaen er nu gemt i systemet og klar til videre behandling.

Med venlig hilsen,
Invoice Processing System`;
}

