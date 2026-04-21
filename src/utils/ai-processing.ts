/**
 * AI processing utilities
 * - Convert attachments to markdown using Cloudflare AI toMarkdown
 * - Extract structured data using LLM
 */

import type { SilverLayerData, GoldLayerData } from './storage';

export interface InvoiceExtraction {
  isInvoice: boolean;
  items: string[];
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  accountBalance: number | null;
  invoiceId: string | null;
  accountIBAN: string | null;
  accountBIC: string | null;
  accountREG: string | null;
  accountNumber: string | null;
  lastPaymentDate: string | null;
  sourceFileReference: string | null;
}

export interface CloudflareAI {
  toMarkdown(
    files: MarkdownDocument | MarkdownDocument[]
  ): Promise<ConversionResult | ConversionResult[]>;
  run(model: string, input: any): Promise<any>;
}

export interface MarkdownDocument {
  name: string;
  blob: Blob;
}

export interface ConversionResult {
  name: string;
  format: 'markdown' | 'error';
  mimetype: string;
  tokens?: number;
  data?: string;
  error?: string;
}

export interface VisionGatewayConfig {
  accountId: string;
  gatewayId: string;
  anthropicApiKey: string;
  gatewayToken?: string;
  model?: string;
}

export function getVisionGatewayConfig(env: any): VisionGatewayConfig | undefined {
  const accountId = env?.CLOUDFLARE_ACCOUNT_ID;
  const gatewayId = env?.AI_GATEWAY_ID;
  const anthropicApiKey = env?.ANTHROPIC_API_KEY;
  const gatewayToken = env?.AI_GATEWAY_TOKEN || undefined;
  const missing: string[] = [];
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!gatewayId) missing.push('AI_GATEWAY_ID');
  if (!anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
  if (missing.length > 0) {
    console.warn(
      `Claude vision extraction disabled — missing env: ${missing.join(', ')}. ` +
        `Image attachments will fall back to Cloudflare toMarkdown, which extracts images poorly.`
    );
    return undefined;
  }
  return { accountId, gatewayId, anthropicApiKey, gatewayToken };
}

const CLAUDE_SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function isImageAttachment(contentType: string): boolean {
  return CLAUDE_SUPPORTED_IMAGE_TYPES.has(contentType.toLowerCase().split(';')[0].trim());
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

const VISION_PROMPT = `You are transcribing an invoice image into a structured key/value markdown document that a downstream parser will read. Do NOT invent values — use "null" for anything not clearly visible.

Return ONLY markdown in this exact shape:

\`\`\`
# <short title of the document>

- document_type: <one of: invoice | receipt | credit_note | payment_request | newsletter | marketing | notification | other>
- supplier: <company name or null>
- invoice_id: <invoice/reference number or null>
- amount: <total amount to pay as a plain number, or null if nothing is due>
- currency: <ISO code like DKK, SEK, EUR, USD, or null>
- account_balance: <positive credit balance in customer's favor as a plain number, or null — use this for credit notes and "belopp tillgodo"/"tilgodehavende" style amounts instead of amount>
- last_payment_date: <due date in YYYY-MM-DD, or null. Look for "Förfallodatum", "Betalningsdatum", "Sista betalningsdag", "Oss til handa", "Oss tillhanda", "Due date", "Forfaldsdato", "Betalingsdato">
- account_iban: <full IBAN with no spaces, or null>
- account_bic: <BIC/SWIFT, or null>
- account_reg: <Danish REG number, null unless currency is DKK>
- account_number: <Danish account number, null unless currency is DKK>

## items
- <line item 1>
- <line item 2>
\`\`\`

Rules:
- Never return a negative amount. If the document shows a credit/negative total, put the absolute value in account_balance and leave amount as null.
- Only populate account_reg and account_number when the currency is DKK.
- Keep items short — one bullet per line item, empty list allowed.
- Output the markdown only, no surrounding prose, no code fences.`;

async function extractImageToMarkdown(
  config: VisionGatewayConfig,
  attachment: { filename: string; contentType: string; data: ArrayBuffer }
): Promise<{ filename: string; content: string }> {
  const model = config.model || 'claude-haiku-4-5-20251001';
  const url = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/anthropic/v1/messages`;
  const mediaType = attachment.contentType.toLowerCase().split(';')[0].trim();

  const body = {
    model,
    max_tokens: 2048,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: arrayBufferToBase64(attachment.data),
            },
          },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    };
    if (config.gatewayToken) {
      headers['cf-aig-authorization'] = `Bearer ${config.gatewayToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude vision call failed ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = (result.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text || '')
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('Empty response from Claude vision');
    }

    return { filename: attachment.filename, content: text };
  } catch (error) {
    console.error(`Error extracting image ${attachment.filename} via Claude:`, error);
    return {
      filename: attachment.filename,
      content: `# ${attachment.filename}\n\n[Image extraction failed: ${error}]`,
    };
  }
}

/**
 * Process email body and attachments to markdown.
 * - Image attachments are routed to Claude via Cloudflare AI Gateway, which
 *   returns a KV-style markdown summary.
 * - Non-image attachments and the email body go through Cloudflare AI toMarkdown.
 */
export async function processEmailAndAttachmentsToMarkdown(
  ai: CloudflareAI,
  emailText?: string,
  emailHtml?: string,
  attachments: Array<{
    filename: string;
    contentType: string;
    data: ArrayBuffer;
  }> = [],
  visionConfig?: VisionGatewayConfig
): Promise<Array<{ filename: string; content: string }>> {
  const imageAttachments = visionConfig
    ? attachments.filter((att) => isImageAttachment(att.contentType))
    : [];
  const otherAttachments = visionConfig
    ? attachments.filter((att) => !isImageAttachment(att.contentType))
    : attachments;

  const markdownDocuments: MarkdownDocument[] = [];

  // Add email body if available (prefer HTML over text)
  if (emailHtml || emailText) {
    const content = emailHtml || emailText || '';
    const contentType = emailHtml ? 'text/html' : 'text/plain';

    if (content) {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(content);
      const contentBuffer = new ArrayBuffer(encoded.length);
      new Uint8Array(contentBuffer).set(encoded);

      markdownDocuments.push({
        name: 'email-body',
        blob: new Blob([contentBuffer], { type: contentType }),
      });
    }
  }

  for (const attachment of otherAttachments) {
    markdownDocuments.push({
      name: attachment.filename,
      blob: new Blob([attachment.data], { type: attachment.contentType }),
    });
  }

  const imageResultsPromise = visionConfig
    ? Promise.all(
        imageAttachments.map((att) => extractImageToMarkdown(visionConfig, att))
      )
    : Promise.resolve<Array<{ filename: string; content: string }>>([]);

  const toMarkdownResultsPromise: Promise<Array<{ filename: string; content: string }>> =
    markdownDocuments.length === 0
      ? Promise.resolve([])
      : (async () => {
          try {
            const results = await ai.toMarkdown(markdownDocuments);
            const resultArray = Array.isArray(results) ? results : [results];
            return resultArray.map((result) => {
              if (result.format === 'error') {
                console.error(
                  `Error converting ${result.name} to markdown:`,
                  result.error
                );
                return {
                  filename: result.name,
                  content: `# ${result.name}\n\n[Conversion error: ${result.error}]`,
                };
              }
              return { filename: result.name, content: result.data || '' };
            });
          } catch (error) {
            console.error('Error converting to markdown:', error);
            return markdownDocuments.map((doc) => ({
              filename: doc.name,
              content: `# ${doc.name}\n\n[AI conversion failed: ${error}]`,
            }));
          }
        })();

  const [imageResults, toMarkdownResults] = await Promise.all([
    imageResultsPromise,
    toMarkdownResultsPromise,
  ]);

  return [...toMarkdownResults, ...imageResults];
}

/**
 * Extract invoice information using LLM
 * Accepts multiple markdown contents and concatenates them internally
 */
export async function extractInvoiceInfo(
  ai: CloudflareAI,
  markdownContents: Array<{ filename: string; content: string }>
): Promise<InvoiceExtraction> {
  // Concatenate all markdown contents with clear separators
  const combinedContent = markdownContents
    .map((file) => `# ${file.filename}\n\n${file.content}\n\n`)
    .join('---\n\n');
  
  const sourceFiles = markdownContents.map((file) => file.filename);
  
  const prompt = `Analyze this email/document and extract invoice information. Return as JSON.

Required fields:
- isInvoice: boolean - true if this is an invoice, bill, credit note, or payment request. Credit notes and documents with a positive credit balance ARE invoices. false if it is a newsletter, notification, marketing email, or any other non-invoice content.
- items: array of strings describing what items/services are covered (can be empty array)
- supplier: the name of the supplier/company that sent the invoice
- amount: the total amount to pay (as a number, null if nothing to pay). IMPORTANT: If this is a credit note or there is a credit balance ("belopp tillgodo", "tilgodehavende", etc.), set amount to null and put the credit in accountBalance instead. Never return a negative amount.
- currency: the currency code (e.g. "DKK", "SEK", "EUR", "USD")
- accountBalance: positive credit balance in your favor (as a number, null if no balance). This is for credit notes or when the customer has prepaid/overpaid. If the document shows a negative total or "belopp tillgodo"/"tilgodehavende", put the absolute value here.
- invoiceId: the invoice number or ID
- accountIBAN: the IBAN (International Bank Account Number) if available. Include the full IBAN without spaces.
- accountBIC: the BIC/SWIFT code for international accounts if available
- accountREG: the REG (registration number) - ONLY for Danish (DKK) invoices, leave null for other currencies
- accountNumber: the account number - ONLY for Danish (DKK) invoices, leave null for other currencies
- lastPaymentDate: the payment due date. Look for fields labeled: "Förfallodatum", "Betalningsdatum", "Sista betalningsdag", "Oss til handa", "Oss tillhanda", "Due date", "Forfaldsdato", "Betalingsdato". Return in YYYY-MM-DD format.
- sourceFileReference: reference to the source file (use the first filename from: ${sourceFiles.join(', ')})

Document content:
${combinedContent}

Return ONLY valid JSON in this exact format:
{
  "isInvoice": true,
  "items": ["item1", "item2"],
  "supplier": "Supplier Name" or null,
  "amount": 1234.56 or null,
  "currency": "DKK" or null,
  "accountBalance": 250.00 or null,
  "invoiceId": "INV-123" or null,
  "accountIBAN": "DK1234567890123456" or null,
  "accountBIC": "DABADKKK" or null,
  "accountREG": "1234" or null,
  "accountNumber": "1234567890" or null,
  "lastPaymentDate": "2024-01-15" or null,
  "sourceFileReference": "filename.pdf" or null
}`;

  try {
    const result = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract structured information from invoices and return ONLY valid JSON, no additional text or explanation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
    });

    const rawResponse = result.response ?? result.text ?? result;
    const responseText = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      return {
        isInvoice: extracted.isInvoice ?? true,
        items: extracted.items ?? [],
        supplier: extracted.supplier ?? null,
        amount: extracted.amount ?? null,
        currency: extracted.currency ?? null,
        accountBalance: extracted.accountBalance ?? null,
        invoiceId: extracted.invoiceId ?? null,
        accountIBAN: extracted.accountIBAN ?? null,
        accountBIC: extracted.accountBIC ?? null,
        accountREG: extracted.accountREG ?? null,
        accountNumber: extracted.accountNumber ?? null,
        lastPaymentDate: extracted.lastPaymentDate ?? null,
        sourceFileReference: extracted.sourceFileReference ?? sourceFiles[0] ?? null,
      };
    }

    throw new Error('No JSON found in AI response');
  } catch (error) {
    console.error('Error extracting invoice info:', error);
    // Return default structure on error
    return {
      isInvoice: true,
      items: [],
      supplier: null,
      amount: null,
      currency: null,
      accountBalance: null,
      invoiceId: null,
      accountIBAN: null,
      accountBIC: null,
      accountREG: null,
      accountNumber: null,
      lastPaymentDate: null,
      sourceFileReference: sourceFiles[0] || null,
    };
  }
}



