// from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
export async function sha256(message: string | Uint8Array) {
  // encode as UTF-8
  const msgBuffer =
    typeof message === "string" ? new TextEncoder().encode(message) : message;

  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}
