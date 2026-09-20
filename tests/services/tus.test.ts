import { afterAll, beforeAll, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Tier } from "../../src/db/types";

process.env.DB_PATH ??= "./data/test-tus.sqlite";
process.env.JWT_SECRET ??= "tus-test-secret";
process.env.ALLOW_UNAUTHENTICATED = "false";

const { default: db } = await import("../../src/db/db");
const { assertUploadAllowed } = await import("../../src/services/tus");
const { incompleteUploadsDir, uploadsDir } = await import("../../src/helpers/paths");
const { resumableUpload } = await import("../../src/pages/upload");
const { jwt } = await import("@elysiajs/jwt");
const { Elysia, t } = await import("elysia");

const freeTier = Object.assign(new Tier(), {
  id: "free",
  name: "Free Tier",
  max_file_size_mb: 100,
  batch_limit: 5,
});

const context = (existingFiles: string[] = []) => ({
  userId: "1",
  jobId: "1",
  tier: freeTier,
  existingFiles,
});

test("a file within the plan's limits is accepted", () => {
  expect(() =>
    assertUploadAllowed(context(), { size: 50 * 1024 * 1024, name: "a.pdf" }),
  ).not.toThrow();
});

test("a file over the plan's size limit is rejected before any bytes are sent", () => {
  expect(() =>
    assertUploadAllowed(context(), { size: 150 * 1024 * 1024, name: "big.mp4" }),
  ).toThrow(expect.objectContaining({ status_code: 413 }));
});

test("an upload of unknown length is rejected", () => {
  expect(() => assertUploadAllowed(context(), { size: undefined, name: "a.pdf" })).toThrow(
    expect.objectContaining({ status_code: 413 }),
  );
});

test("exceeding the batch limit is rejected, but replacing a file is not", () => {
  const full = context(["1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf"]);
  expect(() => assertUploadAllowed(full, { size: 1000, name: "6.pdf" })).toThrow(
    expect.objectContaining({ status_code: 429 }),
  );
  expect(() => assertUploadAllowed(full, { size: 1000, name: "3.pdf" })).not.toThrow();
});

test("a missing filename is rejected", () => {
  expect(() => assertUploadAllowed(context(), { size: 1000, name: "" })).toThrow(
    expect.objectContaining({ status_code: 400 }),
  );
});

// --- protocol round trip over HTTP ---

const port = 3990 + Math.floor(Math.random() * 8);
const base = `http://localhost:${port}`;
let app: { stop: () => void };
let cookie = "";
let userId = 0;
let jobId = 0;

beforeAll(async () => {
  const { id } = db
    .query("INSERT INTO users (email, password) VALUES ('tus@test', 'x') RETURNING id")
    .get() as { id: number };
  userId = id;
  const job = db
    .query("INSERT INTO jobs (user_id, date_created) VALUES (?, ?) RETURNING id")
    .get(userId, new Date().toISOString()) as { id: number };
  jobId = job.id;

  const signer = new Elysia().use(
    jwt({
      name: "jwt",
      schema: t.Object({ id: t.String() }),
      secret: process.env.JWT_SECRET as string,
    }),
  );
  // @ts-expect-error reaching into the plugin's decorator to mint a session for the test
  const token = await signer.decorator.jwt.sign({ id: String(userId) });
  cookie = `auth=${token}; jobId=${jobId}`;

  app = new Elysia().use(resumableUpload).listen(port);
});

afterAll(() => {
  app?.stop();
  db.query("DELETE FROM jobs WHERE id = ?").run(jobId);
  db.query("DELETE FROM users WHERE id = ?").run(userId);
  rmSync(join(uploadsDir, String(userId)), { recursive: true, force: true });
  rmSync(incompleteUploadsDir, { recursive: true, force: true });
});

const createUpload = (
  length: number,
  filename: string,
  extraHeaders: Record<string, string> = {},
) =>
  fetch(`${base}/files`, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(length),
      "Upload-Metadata": `filename ${Buffer.from(filename).toString("base64")}`,
      cookie,
      ...extraHeaders,
    },
  });

test("an interrupted upload resumes from its offset and lands byte-for-byte identical", async () => {
  const name = "تقرير كبير.pdf";
  const body = Buffer.concat([Buffer.alloc(400_000, 7), Buffer.alloc(350_000, 9)]);

  const created = await createUpload(body.length, name);
  expect(created.status).toBe(201);
  const url = created.headers.get("location") as string;

  const first = await fetch(url, {
    method: "PATCH",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": "0",
      "Content-Type": "application/offset+octet-stream",
      cookie,
    },
    body: body.subarray(0, 400_000),
  });
  expect(first.status).toBe(204);

  // The converter must not see a partial upload
  const target = join(uploadsDir, String(userId), String(jobId), name);
  expect(await Bun.file(target).exists()).toBe(false);

  // A client that lost its connection asks where to continue from
  const head = await fetch(url, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0", cookie } });
  expect(head.headers.get("upload-offset")).toBe("400000");

  const second = await fetch(url, {
    method: "PATCH",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": "400000",
      "Content-Type": "application/offset+octet-stream",
      cookie,
    },
    body: body.subarray(400_000),
  });
  expect(second.status).toBe(204);

  const stored = await readFile(target);
  expect(stored.length).toBe(body.length);
  expect(Buffer.compare(stored, body)).toBe(0);
});

test("uploads without a session are rejected", async () => {
  const res = await fetch(`${base}/files`, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": "10",
      "Upload-Metadata": `filename ${Buffer.from("x.pdf").toString("base64")}`,
    },
  });
  expect([401, 302]).toContain(res.status);
});

test("a file larger than the plan allows is refused at creation", async () => {
  const res = await createUpload(200 * 1024 * 1024, "huge.mp4");
  expect(res.status).toBe(413);
});
