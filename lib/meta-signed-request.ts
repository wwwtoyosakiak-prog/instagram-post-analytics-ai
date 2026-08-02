import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaSignedRequestPayload = {
  algorithm?: string;
  user_id?: string;
  issued_at?: number;
  [key: string]: unknown;
};

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + padding, "base64");
}

export function verifyMetaSignedRequest(signedRequest: string, appSecret: string): MetaSignedRequestPayload | null {
  const separator = signedRequest.indexOf(".");
  if (separator <= 0 || separator === signedRequest.length - 1 || !appSecret) return null;

  try {
    const encodedSignature = signedRequest.slice(0, separator);
    const encodedPayload = signedRequest.slice(separator + 1);
    const receivedSignature = decodeBase64Url(encodedSignature);
    const expectedSignature = createHmac("sha256", appSecret).update(encodedPayload).digest();
    if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) return null;

    const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as MetaSignedRequestPayload;
    if (payload.algorithm && payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    if (typeof payload.user_id !== "string" || !payload.user_id.trim()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readAndVerifyMetaSignedRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let signedRequest: string | null = null;
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { signed_request?: unknown } | null;
    signedRequest = typeof body?.signed_request === "string" ? body.signed_request : null;
  } else {
    const form = await request.formData().catch(() => null);
    const value = form?.get("signed_request");
    signedRequest = typeof value === "string" ? value : null;
  }

  const secret = process.env.INSTAGRAM_OAUTH_CLIENT_SECRET;
  return signedRequest && secret ? verifyMetaSignedRequest(signedRequest, secret) : null;
}
