import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignedRequest } from "@/lib/meta-signed-request";

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest();
  return `${encode(signature)}.${encodedPayload}`;
}

describe("Meta signed requests", () => {
  it("accepts an authentic HMAC-SHA256 request", () => {
    const request = sign({ algorithm: "HMAC-SHA256", user_id: "17890001" }, "app-secret");
    expect(verifyMetaSignedRequest(request, "app-secret")?.user_id).toBe("17890001");
  });

  it("rejects tampering, unsupported algorithms, and missing users", () => {
    expect(verifyMetaSignedRequest(sign({ user_id: "17890001" }, "other-secret"), "app-secret")).toBeNull();
    expect(verifyMetaSignedRequest(sign({ algorithm: "HMAC-SHA1", user_id: "17890001" }, "app-secret"), "app-secret")).toBeNull();
    expect(verifyMetaSignedRequest(sign({ algorithm: "HMAC-SHA256" }, "app-secret"), "app-secret")).toBeNull();
  });
});
