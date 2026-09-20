import { rmSync } from "node:fs";
import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import "./helpers/printVersions";
import { unavailableConverters } from "./converters/availability";
import db from "./db/db";
import { Jobs } from "./db/types";
import { AUTO_DELETE_EVERY_N_HOURS, UPLOAD_CHUNK_SIZE_MB, WEBROOT } from "./helpers/env";
import { chooseConverter } from "./pages/chooseConverter";
import { convert } from "./pages/convert";
import { deleteFile } from "./pages/deleteFile";
import { deleteJob } from "./pages/deleteJob";
import { download } from "./pages/download";
import { history } from "./pages/history";
import { listConverters } from "./pages/listConverters";
import { results } from "./pages/results";
import { root } from "./pages/root";
import { resumableUpload, upload } from "./pages/upload";
import { user } from "./pages/user";
import { healthcheck } from "./pages/healthcheck";
import { account } from "./pages/account";
import { admin } from "./pages/admin";
import { billing } from "./pages/billing";
import { legal } from "./pages/legal";
import { outputDir, uploadsDir } from "./helpers/paths";
import { MB, pruneUsage } from "./services/quota";
import { cleanUpExpiredUploads } from "./services/tus";

export { outputDir, uploadsDir } from "./helpers/paths";

// Fix for Elysia issue with Bun, (see https://github.com/oven-sh/bun/issues/12161)
process.getBuiltinModule = require;

// The upload client ships with the app rather than from a CDN. This must run before
// the static plugin below indexes the public folder, or the file is served as 404.
await Bun.write("public/tus.min.js", Bun.file("node_modules/tus-js-client/dist/tus.min.js")).catch(
  (error) => console.error("Could not publish tus.min.js:", error),
);

const app = new Elysia({
  serve: {
    // Files arrive as chunks over the tus protocol, so no request should ever carry
    // a whole file. The margin covers headers and the legacy /upload form encoding.
    maxRequestBodySize: (UPLOAD_CHUNK_SIZE_MB + 16) * MB,
  },
  prefix: WEBROOT,
})
  .use(html())
  .use(
    staticPlugin({
      assets: "public",
      prefix: "",
    }),
  )
  .use(user)
  .use(account)
  .use(root)
  .use(upload)
  .use(resumableUpload)
  .use(history)
  .use(convert)
  .use(download)
  .use(deleteJob)
  .use(results)
  .use(deleteFile)
  .use(listConverters)
  .use(chooseConverter)
  .use(healthcheck)
  .use(admin)
  .use(billing)
  .use(legal)
  .onError(({ error, code, request }) => {
    if (code === "NOT_FOUND") {
      console.warn(`404: ${request.method} ${new URL(request.url).pathname}`);
      return;
    }
    console.error(error);
  });

if (process.env.NODE_ENV !== "production") {
  await import("./helpers/tailwind").then(async ({ generateTailwind }) => {
    const result = await generateTailwind();

    app.get("/generated.css", ({ set }) => {
      set.headers["content-type"] = "text/css";
      return result;
    });
  });
}

app.listen(process.env.PORT || 3000);

for (const { converter, missing } of unavailableConverters()) {
  console.warn(`Converter "${converter}" is disabled: ${missing.join(", ")} not found in PATH.`);
}

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}${WEBROOT}`);

const clearJobs = () => {
  const jobs = db
    .query("SELECT * FROM jobs WHERE date_created < ?")
    .as(Jobs)
    .all(new Date(Date.now() - AUTO_DELETE_EVERY_N_HOURS * 60 * 60 * 1000).toISOString());

  for (const job of jobs) {
    // delete the directories
    rmSync(`${outputDir}${job.user_id}/${job.id}`, {
      recursive: true,
      force: true,
    });
    rmSync(`${uploadsDir}${job.user_id}/${job.id}`, {
      recursive: true,
      force: true,
    });

    // delete the job
    db.query("DELETE FROM file_names WHERE job_id = ?").run(job.id);
    db.query("DELETE FROM jobs WHERE id = ?").run(job.id);
  }

  // Check at least every 15 minutes so files don't outlive the retention
  // window by up to another full N hours.
  setTimeout(clearJobs, Math.min(AUTO_DELETE_EVERY_N_HOURS * 60 * 60 * 1000, 15 * 60 * 1000));
};

if (AUTO_DELETE_EVERY_N_HOURS > 0) {
  clearJobs();
}

// Abandoned partial uploads are not tied to a job yet, so they need their own sweep
cleanUpExpiredUploads();
setInterval(cleanUpExpiredUploads, 60 * 60 * 1000);

// Guest quota counters hold IP addresses; drop old ones even if file auto-delete is off
pruneUsage();
setInterval(pruneUsage, 6 * 60 * 60 * 1000);
