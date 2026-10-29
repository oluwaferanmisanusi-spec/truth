// Shared look for every email: the shop's name, opening line, a details table, more
// paragraphs, an optional button, and the shop's address. Plain-text version alongside.
// Emails are written as drafts; EmailService renders them with the shop's current name
// and address from shop_settings when it sends.

type Button = { label: string; url: string };

export type EmailDraft = {
  to: string;
  subject: string;
  paragraphs: string[];
  rows: [string, string][];
  button?: Button;
};

export type Email = { to: string; subject: string; text: string; html: string };
export type EmailShop = { name: string; address: string };

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function composeEmail(
  to: string,
  subject: string,
  paragraphs: string[],
  rows: [string, string][],
  button?: Button,
): EmailDraft {
  return { to, subject, paragraphs, rows, button };
}

export function renderEmail(draft: EmailDraft, shop: EmailShop): Email {
  const { paragraphs, rows, button } = draft;
  const footer = `${shop.name} · ${shop.address}`;

  const p = (t: string) => `<p style="margin:0 0 16px">${escape(t)}</p>`;
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5a6070">${escape(k)}</td><td style="padding:6px 0">${escape(v)}</td></tr>`,
    )
    .join('');
  const btn = button
    ? `<p style="margin:24px 0"><a href="${escape(button.url)}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escape(button.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Inter,Arial,sans-serif;color:#15181e;font-size:16px;line-height:24px">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#1e3a5f">${escape(shop.name)}</p>
${paragraphs.slice(0, 1).map(p).join('')}
<table style="border-collapse:collapse;margin:0 0 16px">${table}</table>
${paragraphs.slice(1).map(p).join('')}
${btn}
<p style="margin:32px 0 0;color:#5a6070;font-size:14px">${escape(footer)}</p>
</div></body></html>`;

  const text = [
    paragraphs[0],
    rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    ...paragraphs.slice(1),
    button ? `${button.label}: ${button.url}` : '',
    footer,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { to: draft.to, subject: draft.subject, html, text };
}
