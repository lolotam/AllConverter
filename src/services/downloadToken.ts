// Signed download links. The session lives in an httpOnly cookie, so a download manager
// (or curl) fetching a file outside the browser arrives unauthenticated and gets a 401 —
// which IDM reports to the user as "enter your username and password". Carrying a short
// lived signature in the URL lets those tools download the file they were handed without
// granting them anything else. See docs/download-auth.md.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DOWNLOAD_TOKEN_TTL_MINUTES } from "../helpers/env";

// Same fallback as the session signer: without JWT_SECRET the links only last as long as
// the process, which is noisy but never insecure.
const SECRET = process.env.JWT_SECRET ?? randomUUID();

/** Stands in for the filename when the token covers a whole job's archive. */
export const WHOLE_JOB = "*";

type Payload = { u: string; j: string; f: string; e: number };

const encode = (value: string) => Buffer.from(value).toString("base64url");

const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

function signaturesMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Creates a link signature covering one file (or one job's archive, with {@link WHOLE_JOB})
 * for the next {@link DOWNLOAD_TOKEN_TTL_MINUTES} minutes.
 */
export function createDownloadToken(
  userId: string | number,
  jobId: string | number,
  fileName: string = WHOLE_JOB,
  ttlMinutes: number = DOWNLOAD_TOKEN_TTL_MINUTES,
): string {
  const payload: Payload = {
    u: String(userId),
    j: String(jobId),
    f: fileName,
    e: Date.now() + ttlMinutes * 60 * 1000,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Returns the user the token was issued to, or null if it is malformed, expired, or was
 * issued for a different job or file. A token for one file must not fetch another.
 */
export function verifyDownloadToken(
  token: string | undefined,
  expect: { jobId: string; fileName?: string },
): string | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !signaturesMatch(sign(encoded), signature)) {
    return null;
  }

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Payload;
  } catch {
    return null;
  }

  if (typeof payload?.u !== "string" || typeof payload.e !== "number" || payload.e < Date.now()) {
    return null;
  }
  if (payload.j !== expect.jobId) {
    return null;
  }
  // A whole-job token covers every file in it; a per-file token covers only its own
  if (payload.f !== WHOLE_JOB && payload.f !== expect.fileName) {
    return null;
  }

  return payload.u;
}
