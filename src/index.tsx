import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import "./helpers/printVersions";
import { unavailableConverters } from "./converters/availability";
import db from "./db/db";
import { CANONICAL_HOST, UPLOAD_CHUNK_SIZE_MB, WEBROOT } from "./helpers/env";
import { chooseConverter } from "./pages/chooseConverter";
import { convert } from "./pages/convert";
import { deleteFile } from "./pages/deleteFile";
import { deleteJob } from "./pages/deleteJob";
import { download } from "./pages/download";
import { history } from "./pages/history";
import { langRoute } from "./i18n/langRoute";
import { listConverters } from "./pages/listConverters";
import { results } from "./pages/results";
import { root } from "./pages/root";
import { resumableUpload, upload } from "./pages/upload";
import { user } from "./pages/user";
import { healthcheck } from "./pages/healthcheck";
import { account } from "./pages/account";
import { branding } from "./pages/branding";
import { admin } from "./pages/admin";
import { billing } from "./pages/billing";
import { legal } from "./pages/legal";
import { MB, pruneUsage } from "./services/quota";
import { deleteExpiredJobs, ensureCleanupDefaults } from "./services/cleanup";
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
  // Keep every visitor on one hostname, so a session is not lost between www and apex
  .onRequest(({ request }) => {
    if (!CANONICAL_HOST) {
      return;
    }
    const url = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") ?? url.host;
    if (host !== `www.${CANONICAL_HOST}`) {
      return;
    }
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    // 308 so a POST stays a POST
    return new Response(null, { status: 308, headers: { location: url.toString() } });
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
  .use(branding)
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
  .use(langRoute)
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

ensureCleanupDefaults();

const clearJobs = () => {
  deleteExpiredJobs();

  // Every 15 minutes, so a two-hour window is honoured closely enough. The sweep itself
  // decides whether anything should go, so switching deletion on in the admin dashboard
  // takes effect without a restart.
  setTimeout(clearJobs, 15 * 60 * 1000);
};

clearJobs();

// Abandoned partial uploads are not tied to a job yet, so they need their own sweep
cleanUpExpiredUploads();
setInterval(cleanUpExpiredUploads, 60 * 60 * 1000);

// Guest quota counters hold IP addresses; drop old ones even if file auto-delete is off
pruneUsage();
setInterval(pruneUsage, 6 * 60 * 60 * 1000);
