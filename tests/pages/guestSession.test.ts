import { describe, expect, it } from "bun:test";

process.env.ALLOW_UNAUTHENTICATED ??= "true";
process.env.DB_PATH ??= "./data/test-guest-session.sqlite";

const { root } = await import("../../src/pages/root");

const visit = (cookie?: string) =>
  root.handle(new Request("http://convertx.test/", { headers: cookie ? { cookie } : {} }));

const cookieValue = (response: Response, name: string) => {
  const header = response.headers.getSetCookie().find((line) => line.startsWith(`${name}=`));
  return header?.split(";")[0]?.split("=")[1] ?? "";
};

// A new guest identity on every page load left uploads under an id nothing pointed at:
// reloading the page silently lost the visitor's files.
describe("a guest keeps the same identity", () => {
  it("issues an identity on the first visit and keeps it on the next", async () => {
    const first = await visit();
    const auth = cookieValue(first, "auth");
    expect(auth).not.toBe("");

    const second = await visit(`auth=${auth}`);
    const stillAuth = cookieValue(second, "auth");

    // Either the cookie is left alone or it is re-issued for the same visitor
    if (stillAuth) {
      const idOf = (token: string) =>
        JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()).id;
      expect(idOf(stillAuth)).toBe(idOf(auth));
    }
  });
});
