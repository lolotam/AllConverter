// The bits of a signed-in account the header needs. Guests (ALLOW_UNAUTHENTICATED) have
// an id but no row in users, so they get nothing here and keep the plain links.
import db, { getTierById } from "../db/db";
import { User } from "../db/types";
import { avatarUrl, initialsOf } from "../services/avatar";
import { WEBROOT } from "./env";

export type HeaderAccount = {
  accountEmail?: string | undefined;
  accountName?: string | undefined;
  accountAvatar?: string | undefined;
  accountInitials?: string | undefined;
  accountTier?: string | undefined;
  isAdmin?: boolean | undefined;
};

export function headerAccount(userId?: string | number | null): HeaderAccount {
  if (userId === undefined || userId === null) {
    return {};
  }

  const account = db.query("SELECT * FROM users WHERE id = ?").as(User).get(String(userId));
  if (!account) {
    return {};
  }

  const tier = getTierById(account.tier ?? "free");
  return {
    accountEmail: account.email,
    accountName: account.display_name ?? undefined,
    accountAvatar: avatarUrl(WEBROOT, String(account.id), account.avatar_path) ?? undefined,
    accountInitials: initialsOf(account.display_name, account.email),
    accountTier: tier?.name ?? account.tier ?? undefined,
    isAdmin: account.role === "admin",
  };
}
