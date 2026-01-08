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
    name: 'Faktura Galore',
    addr: 'regninger.bjoerkelund@mikkelbjoern.com',
  });
  msg.setRecipient(originalFrom);
  msg.setSubject('Din faktura er gemt!');
  
  const summaryText = generateSummaryText(extraction);
  
  msg.addMessage({
    contentType: 'text/plain',
    data: summaryText,
  });

  const replyMessage = new EmailMessage(
    'regninger.bjoerkelund@mikkelbjoern.com',
    originalFrom,
    msg.asRaw()
  );

  console.log('Generated reply email:', {
    to: originalFrom,
    originalMessageId,
    message: msg.asRaw(),
  });

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
- Konto - IBAN: ${extraction.accountIBAN || 'Ikke angivet'}
- Konto - BIC: ${extraction.accountBIC || 'Ikke angivet'}
- Konto - Reg. nummer: ${extraction.accountREG || 'Ikke angivet'}
- Konto - Kontonummer: ${extraction.accountNumber || 'Ikke angivet'}
- ${paymentDateText}
- Kildefil: ${extraction.sourceFileReference || 'Ikke angivet'}

📦 Dækkede Varer/Tjenester:
${itemsList}

Fakturaen er nu gemt i systemet og klar til videre behandling.
Tjek dem her: https://regninger.mikkelbjoern.com

Med venlig hilsen,
Faktura Galore AI.

`;
}

/**
 * Generate an error reply email when invoice processing fails
 */
export function generateErrorReplyEmail(
  originalMessageId: string | null,
  originalFrom: string,
  errorMessage?: string
): EmailMessage {
  const msg = createMimeMessage();
  
  if (originalMessageId) {
    msg.setHeader('In-Reply-To', originalMessageId);
  }
  
  msg.setSender({
    name: 'Faktura Galore',
    addr: 'regninger.bjoerkelund@mikkelbjoern.com',
  });
  msg.setRecipient(originalFrom);
  msg.setSubject('Vi fik ikke tygget din faktura igemmen. Øv!');
  
  const errorText = generateErrorText(errorMessage);
  
  msg.addMessage({
    contentType: 'text/plain',
    data: errorText,
  });

  const replyMessage = new EmailMessage(
    'regninger.bjoerkelund@mikkelbjoern.com',
    originalFrom,
    msg.asRaw()
  );

  console.log('Generated error reply email:', {
    to: originalFrom,
    originalMessageId,
  });

  return replyMessage;
}

/**
 * Generate error message text
 */
function generateErrorText(errorMessage?: string): string {
  const details = errorMessage
    ? `\nFejldetaljer: ${errorMessage}`
    : '';

  return `Beklager, der opstod en fejl under behandlingen af din faktura.

Vi kunne ikke behandle den vedhæftede faktura. Prøv venligst at sende den igen, eller kontakt support hvis problemet fortsætter.${details}

Med venlig hilsen,
Faktura Galore AI.

`;
}
