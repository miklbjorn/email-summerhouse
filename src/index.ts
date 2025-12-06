/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx): Promise<Response> {
// 		return new Response('Hello World!');
// 	},
// } satisfies ExportedHandler<Env>;

import * as PostalMime from 'postal-mime';
import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";

export default {
  async email(message, env, ctx) {

	const allowedSenders = [
		env.ALLOWED_SENDER_EMAIL_ADDRESS_1,
		env.ALLOWED_SENDER_EMAIL_ADDRESS_2
	];

	const parser = new PostalMime.default();
    const rawEmail = new Response(message.raw);
    const email = await parser.parse(await rawEmail.arrayBuffer());
    
	const fromAddress = email.from?.address ?? "<from-address-missing>";
	const toAddresses = email.to?.map(addr => addr.address) ?? [];

	if (!allowedSenders.includes(fromAddress)) {
		console.log({
			message: `Blocked email from unauthorized sender. Sender ${fromAddress}, not in allowed list: ${allowedSenders.join(", ")}.`,
			"email": email
		});
		message.setReject("Unauthorized sender");
		return;
	}

	let processed = false;
	if (toAddresses.includes(env.INVOICE_EMAIL_ADDRESS) ){
		console.log({
			"message": "Processing invoice email",
			"email": email
		});
		processed = true;
	};
	if (toAddresses.includes(env.PROJECTS_EMAIL_ADDRESS) ){
		console.log({
			"message": "Processing projects email",
			"email": email
		});
		processed = true;
	};
	if (!processed) {
		console.error({
			message: `Blocked email to unknown recipient. Recipients: ${toAddresses.join(", ")}`
			+``+` not matching any of the known addresses: ${env.INVOICE_EMAIL_ADDRESS}, ${env.PROJECTS_EMAIL_ADDRESS}.`,
			"email": email
		});
		message.setReject("Unknown recipient");
		return;
	}





    

	const msg = createMimeMessage();
    msg.setHeader("In-Reply-To", message.headers.get("Message-ID"));
    msg.setSender({ name: "Tak for din mail!", addr: "bjoerkelund@mikkelbjoern.com" });
    msg.setRecipient(message.from);
    msg.setSubject("Email Routing Auto-reply");
    msg.addMessage({
      contentType: 'text/plain',
      data: `Vi mangler lige at skrive koden, der kan håndtere den..`
    });

    const replyMessage = new EmailMessage(
      "bjoerkelund@mikkelbjoern.com",
      message.from,
      msg.asRaw()
    );

    await message.reply(replyMessage);


  },
};

export async function fetch(request, env, ctx) {
    return new Response("H");
  }
;