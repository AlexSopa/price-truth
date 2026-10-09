// Owner vault: the owner's own data is published only encrypted. Same code in Node (build) and the browser.
// gzip → AES-256-GCM, key from the password by PBKDF2-SHA256. Without the password the file is unreadable.

const ITER = 310000;
const enc = new TextEncoder();

function toB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITER);
  const packed = await pipe(enc.encode(JSON.stringify(obj)), new CompressionStream("gzip"));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: ITER, cipher: "AES-256-GCM", salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
}

// Throws on a wrong password (the AES-GCM tag does not match).
export async function unseal(vault, password) {
  const key = await deriveKey(password, fromB64(vault.salt), vault.iter);
  const packed = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(vault.iv) }, key, fromB64(vault.ct)));
  return JSON.parse(new TextDecoder().decode(await pipe(packed, new DecompressionStream("gzip"))));
}
