import { describe, expect, it } from "bun:test";
import {
  WHOLE_JOB,
  createDownloadToken,
  verifyDownloadToken,
} from "../../src/services/downloadToken";

describe("download tokens", () => {
  it("returns the user a per-file token was issued to", () => {
    const token = createDownloadToken("3", "12", "page-0.jpg");
    expect(verifyDownloadToken(token, { jobId: "12", fileName: "page-0.jpg" })).toBe("3");
  });

  it("covers every file in the job when issued for the whole job", () => {
    const token = createDownloadToken("3", "12", WHOLE_JOB);
    expect(verifyDownloadToken(token, { jobId: "12", fileName: "anything.png" })).toBe("3");
    expect(verifyDownloadToken(token, { jobId: "12" })).toBe("3");
  });

  it("refuses a token issued for another file or another job", () => {
    const token = createDownloadToken("3", "12", "page-0.jpg");
    expect(verifyDownloadToken(token, { jobId: "12", fileName: "secret.pdf" })).toBeNull();
    expect(verifyDownloadToken(token, { jobId: "99", fileName: "page-0.jpg" })).toBeNull();
  });

  it("refuses an expired token", () => {
    const token = createDownloadToken("3", "12", WHOLE_JOB, -1);
    expect(verifyDownloadToken(token, { jobId: "12" })).toBeNull();
  });

  it("refuses a tampered payload, a bad signature and junk", () => {
    const token = createDownloadToken("3", "12", WHOLE_JOB);
    const [payload, signature] = token.split(".");
    // Same signature, payload rewritten to claim another user
    const forged = Buffer.from(
      JSON.stringify({ u: "4", j: "12", f: WHOLE_JOB, e: Date.now() + 1000 }),
    ).toString("base64url");
    expect(verifyDownloadToken(`${forged}.${signature}`, { jobId: "12" })).toBeNull();
    expect(verifyDownloadToken(`${payload}.not-the-signature`, { jobId: "12" })).toBeNull();
    expect(verifyDownloadToken("garbage", { jobId: "12" })).toBeNull();
    expect(verifyDownloadToken(undefined, { jobId: "12" })).toBeNull();
  });
});
