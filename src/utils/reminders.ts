/**
 * Daily payment reminders
 *
 * Sends one collected reminder email per day when either:
 * - an unpaid invoice has entered the window of 3 days before its due date
 *   (and has not triggered a reminder before), or
 * - there is any overdue unpaid invoice
 */

import { createMimeMessage } from 'mimetext';
import { EmailMessage } from 'cloudflare:email';
import type { D1Database } from './database';

const REMINDER_DAYS_BEFORE_DUE = 3;
const SENDER_ADDRESS = 'regninger.bjoerkelund@mikkelbjoern.com';

export interface ReminderInvoice {
  id: number;
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  invoice_id: string | null;
  last_payment_date: string;
  reminder_sent_at: string | null;
}

export interface ReminderCandidates {
  dueSoon: ReminderInvoice[];
  overdue: ReminderInvoice[];
}

/**
 * Find unpaid invoices that are due within the reminder window, or overdue
 */
export async function findReminderCandidates(db: D1Database): Promise<ReminderCandidates> {
  const columns = 'id, supplier, amount, currency, invoice_id, last_payment_date, reminder_sent_at';

  const dueSoon = await db
    .prepare(
      `SELECT ${columns} FROM invoices
       WHERE status = 'unpaid'
         AND last_payment_date >= date('now')
         AND last_payment_date <= date('now', ?)
       ORDER BY last_payment_date ASC`
    )
    .bind(`+${REMINDER_DAYS_BEFORE_DUE} days`)
    .all<ReminderInvoice>();

  const overdue = await db
    .prepare(
      `SELECT ${columns} FROM invoices
       WHERE status = 'unpaid'
         AND last_payment_date < date('now')
       ORDER BY last_payment_date ASC`
    )
    .all<ReminderInvoice>();

  return { dueSoon: dueSoon.results, overdue: overdue.results };
}

/**
 * A reminder is due if any invoice newly entered the due-soon window,
 * or if anything is overdue
 */
export function shouldSendReminder(candidates: ReminderCandidates): boolean {
  const newlyDueSoon = candidates.dueSoon.some((invoice) => !invoice.reminder_sent_at);
  return newlyDueSoon || candidates.overdue.length > 0;
}

/**
 * Check for invoices needing a reminder and send one collected email if so
 */
export async function sendDailyReminder(
  db: D1Database,
  emailBinding: SendEmail,
  recipient: string
): Promise<void> {
  const candidates = await findReminderCandidates(db);

  if (!shouldSendReminder(candidates)) {
    console.log('No payment reminder needed today', {
      dueSoon: candidates.dueSoon.length,
      overdue: candidates.overdue.length,
    });
    return;
  }

  await emailBinding.send(generateReminderEmail(recipient, candidates));
  console.log('Sent payment reminder', {
    to: recipient,
    dueSoon: candidates.dueSoon.length,
    overdue: candidates.overdue.length,
  });

  // Mark due-soon invoices so they don't trigger a reminder again
  const unmarked = candidates.dueSoon.filter((invoice) => !invoice.reminder_sent_at);
  if (unmarked.length > 0) {
    await db.batch(
      unmarked.map((invoice) =>
        db
          .prepare(`UPDATE invoices SET reminder_sent_at = datetime('now') WHERE id = ?`)
          .bind(invoice.id)
      )
    );
  }
}

/**
 * Generate the collected reminder email
 */
export function generateReminderEmail(
  recipient: string,
  candidates: ReminderCandidates
): EmailMessage {
  const msg = createMimeMessage();

  msg.setSender({
    name: 'Faktura Galore',
    addr: SENDER_ADDRESS,
  });
  msg.setRecipient(recipient);

  const subjectParts: string[] = [];
  if (candidates.overdue.length > 0) {
    const overdueLabel = candidates.overdue.length === 1 ? 'forfalden' : 'forfaldne';
    subjectParts.push(`${candidates.overdue.length} ${overdueLabel}`);
  }
  if (candidates.dueSoon.length > 0) {
    subjectParts.push(`${candidates.dueSoon.length} forfalder snart`);
  }
  msg.setSubject(`Betalingspåmindelse: ${subjectParts.join(', ')}`);

  msg.addMessage({
    contentType: 'text/plain',
    data: generateReminderText(candidates),
  });

  return new EmailMessage(SENDER_ADDRESS, recipient, msg.asRaw());
}

function formatInvoiceLine(invoice: ReminderInvoice): string {
  const amountFormatted = invoice.amount
    ? new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: invoice.currency || 'DKK',
        currencyDisplay: 'code',
      }).format(invoice.amount)
    : 'Beløb ikke angivet';
  const invoiceRef = invoice.invoice_id ? ` (faktura ${invoice.invoice_id})` : '';

  return `  - ${invoice.last_payment_date}: ${invoice.supplier || 'Ukendt leverandør'}${invoiceRef} – ${amountFormatted}`;
}

function generateReminderText(candidates: ReminderCandidates): string {
  const sections: string[] = [];

  if (candidates.overdue.length > 0) {
    sections.push(`⚠️ Forfaldne fakturaer:\n${candidates.overdue.map(formatInvoiceLine).join('\n')}`);
  }
  if (candidates.dueSoon.length > 0) {
    sections.push(
      `⏰ Forfalder inden for ${REMINDER_DAYS_BEFORE_DUE} dage:\n${candidates.dueSoon.map(formatInvoiceLine).join('\n')}`
    );
  }

  return `Hej!

Der er ubetalte fakturaer, der kræver din opmærksomhed:

${sections.join('\n\n')}

Tjek dem her: https://regninger.mikkelbjoern.com

Med venlig hilsen,
Faktura Galore AI.

`;
}
