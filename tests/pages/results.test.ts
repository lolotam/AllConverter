import { expect, test } from "bun:test";
import { buildDownloadUrl } from "../../src/helpers/buildDownloadUrl";

test("encodes reserved characters in download filenames", () => {
  expect(buildDownloadUrl("", "1/2/", "clip #1?.gif")).toBe("/download/1/2/clip%20%231%3F.gif");
});

test("preserves output path segments while encoding the filename", () => {
  expect(buildDownloadUrl("/convertx", "user/job/", "報告 100%.pdf")).toBe(
    "/convertx/download/user/job/%E5%A0%B1%E5%91%8A%20100%25.pdf",
  );
});

// --- deleting a converted file ---

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

process.env.DB_PATH ??= "./data/test-results.sqlite";
process.env.JWT_SECRET ??= "results-test-secret";

const { default: db } = await import("../../src/db/db");
const { outputDir } = await import("../../src/helpers/paths");
const { results } = await import("../../src/pages/results");

const session = async (userId: number, jobId: number) => {
  const signer = new Elysia().use(
    jwt({
      name: "jwt",
      schema: t.Object({ id: t.String() }),
      secret: process.env.JWT_SECRET as string,
    }),
  );
  // @ts-expect-error reaching into the plugin's decorator to mint a session for the test
  const token = await signer.decorator.jwt.sign({ id: String(userId) });
  return `auth=${token}; jobId=${jobId}`;
};

const newUserWithJob = (email: string) => {
  const user = db
    .query("INSERT INTO users (email, password) VALUES (?, 'x') RETURNING id")
    .get(email) as { id: number };
  const job = db
    .query(
      "INSERT INTO jobs (user_id, date_created, status) VALUES (?, ?, 'completed') RETURNING id",
    )
    .get(user.id, new Date().toISOString()) as { id: number };
  return { userId: user.id, jobId: job.id };
};

test("deleting a converted file removes it from disk and from the results", async () => {
  const { userId, jobId } = newUserWithJob(`owner-${Date.now()}@test`);
  const intruder = newUserWithJob(`intruder-${Date.now()}@test`);
  const dir = `${outputDir}${userId}/${jobId}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/page-0.jpg`, "image-bytes");
  db.query(
    "INSERT INTO file_names (job_id, file_name, output_file_name, status) VALUES (?, 'doc.pdf', 'page-0.jpg', 'Done')",
  ).run(jobId);

  const port = 3970 + Math.floor(Math.random() * 9);
  const app = new Elysia().use(results).listen(port);
  const url = `http://localhost:${port}/results/${jobId}/delete`;
  const send = (cookie: string) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ filename: "page-0.jpg" }),
    });

  // Someone else's session must not be able to delete it
  const refused = await send(await session(intruder.userId, intruder.jobId));
  expect(refused.status).toBe(404);
  expect(await Bun.file(`${dir}/page-0.jpg`).exists()).toBe(true);

  const allowed = await send(await session(userId, jobId));
  expect(allowed.status).toBe(200);
  expect(await Bun.file(`${dir}/page-0.jpg`).exists()).toBe(false);
  expect(
    db.query("SELECT COUNT(*) AS n FROM file_names WHERE job_id = ?").get(jobId) as { n: number },
  ).toEqual({ n: 0 });

  app.stop();
  rmSync(`${outputDir}${userId}`, { recursive: true, force: true });
  for (const id of [userId, intruder.userId]) {
    db.query("DELETE FROM jobs WHERE user_id = ?").run(id);
    db.query("DELETE FROM users WHERE id = ?").run(id);
  }
});
