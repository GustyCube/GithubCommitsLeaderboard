function encodeBytes(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function decodeBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function deriveBytes(secret: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
}

async function deriveAesKey(secret: string) {
  return crypto.subtle.importKey("raw", await deriveBytes(secret), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function deriveHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    await deriveBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function encryptText(secret: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${encodeBytes(iv)}.${encodeBytes(new Uint8Array(encrypted))}`;
}

export async function decryptText(secret: string, ciphertext: string) {
  const [ivPart, payloadPart] = ciphertext.split(".");

  if (!ivPart || !payloadPart) {
    throw new Error("Malformed ciphertext");
  }

  const key = await deriveAesKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBytes(ivPart),
    },
    key,
    decodeBytes(payloadPart),
  );

  return new TextDecoder().decode(decrypted);
}

export async function signValue(secret: string, value: string) {
  const key = await deriveHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeBytes(new Uint8Array(signature));
}

export async function verifySignedValue(secret: string, value: string, signature: string) {
  const key = await deriveHmacKey(secret);

  return crypto.subtle.verify("HMAC", key, decodeBytes(signature), new TextEncoder().encode(value));
}
