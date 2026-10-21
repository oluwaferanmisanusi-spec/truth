// Paystack (test mode) over its REST API. Server only: uses the secret key.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.paystack.co";

type PaystackResponse<T> = { status: boolean; message: string; data: T };

async function paystack<T>(path: string, init?: RequestInit): Promise<PaystackResponse<T>> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const body = (await res.json()) as PaystackResponse<T>;
  if (!res.ok || !body.status) {
    throw new Error(`Paystack ${path} failed (${res.status}): ${body.message}`);
  }
  return body;
}

/** Starts a payment and returns the Paystack checkout page to send the customer to. */
export async function initializeTransaction(input: {
  reference: string;
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  const { data } = await paystack<{ authorization_url: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        reference: input.reference,
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        callback_url: input.callbackUrl,
        // Paystack sends people here if they press "Cancel payment" on its page.
        metadata: { ...input.metadata, cancel_action: input.callbackUrl },
      }),
    },
  );
  return data.authorization_url;
}

export type VerifiedTransaction = {
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed";
  reference: string;
  amount: number;
  paid_at: string | null;
  gateway_response: string;
};

/** Paystack's own answer about a payment; never trust the browser's redirect alone. */
export async function verifyTransaction(reference: string) {
  const { data } = await paystack<VerifiedTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return data;
}

/** Full or partial refund of a successful transaction. */
export async function createRefund(reference: string, amountKobo: number) {
  const { data } = await paystack<{ id: number; status: string }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: reference, amount: amountKobo }),
  });
  return data;
}

/** Webhooks are signed with HMAC-SHA512 of the raw body using the secret key. */
export function isValidWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
