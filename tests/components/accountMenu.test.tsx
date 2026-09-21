import { expect, test } from "bun:test";
import { Header } from "../../src/components/header";

/** The header returns a JSX string; these tests read the markup it produces. */
function render(props: Parameters<typeof Header>[0]): string {
  return String(Header(props));
}

const signedIn = {
  loggedIn: true,
  accountEmail: "someone@example.com",
  accountInitials: "SE",
  accountTier: "Free Tier",
  accountUsed: 2,
  accountLimit: 10,
};

test("the admin dashboard link is only in the menu for an admin", () => {
  expect(render({ ...signedIn, isAdmin: true })).toContain("/admin");
  expect(render({ ...signedIn, isAdmin: false })).not.toContain(`href="/admin"`);
});

test("a guest gets the sign-in links instead of the menu", () => {
  const markup = render({ loggedIn: false, accountRegistration: true });
  // The closing script always mentions the menu, so look for the button itself
  expect(markup).not.toContain(`aria-haspopup="menu"`);
  expect(markup).toContain("/login");
  expect(markup).toContain("/register");
});

test("the menu shows what is left of today's quota", () => {
  expect(render(signedIn)).toContain("8 of 10 conversions left today");
});

test("an unlimited plan is described instead of metered", () => {
  const markup = render({ ...signedIn, accountUnlimited: true, accountLimit: 1_000_000 });
  expect(markup).toContain("Unlimited conversions");
  expect(markup).not.toContain("conversions left today");
});

test("only a free account is invited to upgrade", () => {
  expect(render(signedIn)).toContain("Upgrade plan");
  expect(render({ ...signedIn, accountPaid: true })).not.toContain("Upgrade plan");
});

test("every menu entry is reachable and sign out is last", () => {
  const markup = render({ ...signedIn, isAdmin: true });
  for (const href of ["/account", "/history", "/account#plan", "/converters", "/logoff"]) {
    expect(markup).toContain(`href="${href}"`);
  }
  expect(markup.indexOf("/logoff")).toBeGreaterThan(markup.indexOf("/account#plan"));
});

test("a visitor with no account still gets an avatar menu", () => {
  // ALLOW_UNAUTHENTICATED gives a guest an id but no row in users
  const markup = render({ loggedIn: true, accountRegistration: true });
  expect(markup).toContain(`aria-haspopup="menu"`);
  expect(markup).toContain("Browsing as a guest");
  for (const href of ["/login", "/register", "/history", "/converters", "/#pricing"]) {
    expect(markup).toContain(`href="${href}"`);
  }
});

test("a guest is offered no profile, no sign out and no admin", () => {
  const markup = render({ loggedIn: true, accountRegistration: true, isAdmin: true });
  for (const href of ["/logoff", "/admin", "/account"]) {
    expect(markup).not.toContain(`href="${href}"`);
  }
});

test("registration links stay hidden when registration is closed", () => {
  const markup = render({ loggedIn: true, accountRegistration: false });
  expect(markup).not.toContain(`href="/register"`);
  expect(markup).toContain(`href="/login"`);
});

test("history is dropped from the menu when the feature is off", () => {
  const markup = render({ ...signedIn, hideHistory: true });
  expect(markup).not.toContain(`href="/history"`);
  expect(markup).toContain(`href="/account"`);
});
