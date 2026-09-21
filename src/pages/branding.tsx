import { Elysia } from "elysia";
import { brandingFile } from "../services/branding";

/** Serves the uploaded logo and favicon. Public, like the artwork they replace. */
export const branding = new Elysia().get("/branding/:asset", async ({ params, set }) => {
  if (params.asset !== "logo" && params.asset !== "favicon") {
    set.status = 404;
    return { message: "Unknown branding asset." };
  }

  const file = brandingFile(params.asset);
  if (!file) {
    set.status = 404;
    return { message: "No custom artwork uploaded." };
  }

  const contents = Bun.file(file.path);
  if (!(await contents.exists())) {
    set.status = 404;
    return { message: "No custom artwork uploaded." };
  }

  set.headers["content-type"] = file.contentType;
  set.headers["x-content-type-options"] = "nosniff";
  // The URL carries a version, so a long cache never hides a replacement
  set.headers["cache-control"] = "public, max-age=31536000";
  return contents;
});
