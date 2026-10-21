// Sends email through Resend. A failed email never undoes a booking or refund: we log it
// and carry on, because the customer can still see everything on the website.
import "server-only";

type Email = { to: string; subject: string; text: string; html: string };

export async function sendEmail(email: Email) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...email, to: [email.to] }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Email not sent", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email not sent", error);
    return false;
  }
}

// Shared look for every email: wordmark, opening line, a details table, more paragraphs,
// an optional button, and the shop's address. Plain-text version alongside.
const SHOP_ADDRESS = "14 Example Street, Lekki, Lagos";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(paragraphs: string[], rows: [string, string][], button?: { label: string; url: string }) {
  const p = (t: string) => `<p style="margin:0 0 16px">${t}</p>`;
  const table = rows
    .map(([k, v]) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#5a6070">${escape(k)}</td><td style="padding:6px 0">${escape(v)}</td></tr>`)
    .join("");
  const btn = button
    ? `<p style="margin:24px 0"><a href="${button.url}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escape(button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Inter,Arial,sans-serif;color:#15181e;font-size:16px;line-height:24px">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#1e3a5f">Truth</p>
${paragraphs.slice(0, 1).map(p).join("")}
<table style="border-collapse:collapse;margin:0 0 16px">${table}</table>
${paragraphs.slice(1).map(p).join("")}
${btn}
<p style="margin:32px 0 0;color:#5a6070;font-size:14px">Truth · ${SHOP_ADDRESS}</p>
</div></body></html>`;
}

function plain(paragraphs: string[], rows: [string, string][], button?: { label: string; url: string }) {
  return [
    paragraphs[0],
    rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    ...paragraphs.slice(1),
    button ? `${button.label}: ${button.url}` : "",
    `Truth · ${SHOP_ADDRESS}`,
  ].filter(Boolean).join("\n\n");
}

export function composeEmail(to: string, subject: string, paragraphs: string[], rows: [string, string][], button?: { label: string; url: string }) {
  const safe = paragraphs.map(escape);
  return { to, subject, html: layout(safe, rows, button), text: plain(paragraphs, rows, button) };
}
