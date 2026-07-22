import { env } from "./env.js";
import { resend } from "./clients.js";
import type { DigestSynthesis } from "@knewledge/contracts";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function sendDigestEmail(input: { email: string; digestId: string; digest: DigestSynthesis; itemCount: number }) {
  const themes = input.digest.themes.map((theme) => `<li><strong>${escape(theme.name)}</strong><br>${escape(theme.summary)}</li>`).join("");
  const relations = input.digest.relations.slice(0, 8).map((relation) => `<li><strong>${escape(relation.type.replace("_", " "))}</strong> — ${escape(relation.explanation)}</li>`).join("");
  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.email,
    subject: input.digest.title,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#17382f"><p style="font-size:12px;letter-spacing:.12em;color:#6f8a79">YOUR WEEKLY KNEWLEDGE</p><h1 style="font-family:Georgia,serif;font-size:38px">${escape(input.digest.title)}</h1><p style="line-height:1.65;color:#586a61">${escape(input.digest.overview)}</p><hr style="border:0;border-top:1px solid #dfe5dc;margin:30px 0"><h2 style="font-family:Georgia,serif">Themes from ${input.itemCount} captures</h2><ul style="line-height:1.6">${themes}</ul>${relations ? `<h2 style="font-family:Georgia,serif;margin-top:30px">Connections to the past</h2><ul style="line-height:1.6">${relations}</ul>` : ""}<a href="${env.NEXT_PUBLIC_APP_URL}/digests/${input.digestId}" style="display:inline-block;margin-top:25px;background:#17382f;color:white;padding:13px 18px;border-radius:24px;text-decoration:none">Read the full digest</a></div>`,
  });
}

