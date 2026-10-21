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
