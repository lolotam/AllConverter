import { Elysia, t } from "elysia";
import db from "../db/db";
import { User } from "../db/types";
import { PADDLE_WEBHOOK_SECRET, WEBROOT } from "../helpers/env";
import {
  applySubscriptionEvent,
  createPortalUrl,
  PaddleEvent,
  verifyPaddleSignature,
} from "../services/paddle";
import { userService } from "./user";

export const billing = new Elysia()
  .use(userService)
  .post(
    "/paddle/webhook",
    ({ body, request, status }) => {
      if (!PADDLE_WEBHOOK_SECRET) {
        return status(404, { message: "Billing is not configured." });
      }

      // The signature covers the exact raw bytes, hence parse: "text"
      if (
        !verifyPaddleSignature(body, request.headers.get("paddle-signature"), PADDLE_WEBHOOK_SECRET)
      ) {
        return status(401, { message: "Invalid signature." });
      }

      let event: PaddleEvent;
      try {
        event = JSON.parse(body) as PaddleEvent;
      } catch {
        return status(400, { message: "Invalid JSON." });
      }

      const result = applySubscriptionEvent(event, PADDLE_WEBHOOK_SECRET);
      if (!result.applied) {
        console.warn(`Paddle ${event.event_type} not applied: ${result.reason}`);
      }

      // Always 200 for authentic events, otherwise Paddle keeps retrying ones we chose to skip
      return { received: true };
    },
    { parse: "text", body: t.String() },
  )
  .get(
    "/billing/portal",
    async ({ user, redirect }) => {
      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);
      const url = userData ? await createPortalUrl(userData) : null;
      return redirect(url ?? `${WEBROOT}/account?billing=unavailable`, 302);
    },
    { auth: true },
  );
