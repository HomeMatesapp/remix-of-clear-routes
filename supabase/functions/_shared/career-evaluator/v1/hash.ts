// Canonical JSON serialisation + sha256 hex.
//
// Rules:
//   • Object keys are emitted in sorted order at every depth.
//   • Arrays keep their original order (order is semantically significant).
//   • No whitespace, no trailing separators.
//   • Numbers/strings/booleans/null serialise as native JSON.
//
// Same input → same 64-hex sha256 in Node/Bun and in Deno.
// Both runtimes expose the Web Crypto API as `crypto.subtle`.

export const canonicalStringify = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalise non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
  }
  throw new Error(`cannot canonicalise value of type ${typeof value}`);
};

const toHex = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
};

export const sha256Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

export const canonicalHash = async (value: unknown): Promise<string> => sha256Hex(canonicalStringify(value));
