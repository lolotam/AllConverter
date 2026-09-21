import { Elysia, t } from "elysia";
import {
  AnalyticsPanel,
  ConversionsPanel,
  HealthPanel,
  SitePanel,
  StoragePanel,
} from "../components/adminPanels";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db, {
  deleteUserById,
  getAllUsers,
  getStats,
  getTiers,
  getUserById,
  updateTier,
  updateUserRole,
  updateUserTier,
} from "../db/db";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  BRANDING,
  HIDE_HISTORY,
  WEBROOT,
} from "../helpers/env";
import { headerAccount } from "../helpers/headerUser";
import {
  analytics,
  formatUsage,
  queueSnapshot,
  storageUsage,
  systemHealth,
} from "../services/adminStats";
import { brandingUrl, removeBrandingAsset, saveBrandingAsset } from "../services/branding";
import { initialsOf } from "../services/avatar";
import { siteName, siteTagline, setSiteName, setSiteTagline } from "../services/siteName";
import { formatCatalogue, setOfferedFormats, setPreferredConverters } from "../services/features";
import {
  CLEANUP_INTERVAL_CHOICES,
  deleteJobs,
  cleanupEnabled,
  cleanupOverrideHours,
  deleteExpiredJobs,
  deleteOrphanedUploads,
  purgeAllJobs,
  setCleanupEnabled,
  setCleanupOverrideHours,
} from "../services/cleanup";
import { GOOGLE_ENABLED } from "../services/google";
import { PADDLE_ENABLED } from "../services/paddle";
import { userService } from "../services/user";

export const admin = new Elysia({ prefix: `${WEBROOT}/admin` })
  .use(userService)
  // Dashboard Overview & Main UI
  .get(
    "/",
    async ({ jwt, redirect, cookie: { auth }, query }) => {
      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const currentUser = getUserById(verified.id);
      if (!currentUser || currentUser.role !== "admin") {
        return (
          <BaseHtml title="Access Denied | Admin" webroot={WEBROOT}>
            <div class="mx-auto my-20 max-w-md rounded-2xl border border-terracotta/30 bg-surface p-8 text-center shadow-2xl">
              <div class="mb-4 text-5xl">🚫</div>
              <h1 class="text-2xl font-bold text-ink mb-2">Access Denied</h1>
              <p class="text-ink-muted text-sm mb-6">
                You do not have administrative privileges to access this area.
              </p>
              <a href={`${WEBROOT}/`} class="btn-primary inline-block text-sm px-6 py-2.5">
                Return to Home
              </a>
            </div>
          </BaseHtml>
        );
      }

      const stats = getStats();
      const users = getAllUsers();
      const tiers = getTiers();
      const currentTab = query.tab || "overview";
      const message = query.msg || "";

      return (
        <BaseHtml title={`${BRANDING} | Admin Dashboard`} webroot={WEBROOT} customFooter={true}>
          <>
            <Header
              webroot={WEBROOT}
              branding={BRANDING}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn={true}
              {...headerAccount(currentUser.id)}
            />

            <div class="min-h-screen bg-canvas text-ink transition-colors">
              {/* Dashboard header */}
              <div class="border-b border-rule bg-surface px-4 py-4 backdrop-blur sm:px-8">
                <div class="mx-auto flex max-w-7xl items-center gap-3">
                  <div class="flex size-10 items-center justify-center rounded-xl border border-marigold/50 bg-marigold/20 text-xl font-bold text-ink-muted">
                    ⚡
                  </div>
                  <div>
                    <h1 class="text-xl font-black text-ink">Admin Command Center</h1>
                    <p class="text-xs text-ink-muted">
                      Manage users, plans, storage and how the site looks
                    </p>
                  </div>
                </div>
              </div>

              {/* Notification Banner */}
              {message && (
                <div class="mx-auto max-w-7xl px-4 pt-4 sm:px-8">
                  <div class="rounded-xl border border-forest/30 bg-forest/10 px-4 py-3 text-sm text-forest font-medium flex items-center justify-between">
                    <span>✓ {message}</span>
                    <a
                      href={`${WEBROOT}/admin?tab=${currentTab}`}
                      class="text-xs text-ink-muted hover:text-ink"
                    >
                      ✕
                    </a>
                  </div>
                </div>
              )}

              {/* Side menu and content */}
              <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row">
                <nav class="lg:w-56 lg:shrink-0">
                  <ul class="flex flex-wrap gap-1 lg:sticky lg:top-24 lg:flex-col">
                    {[
                      { id: "overview", label: "Overview", icon: "📊" },
                      { id: "users", label: `Users (${users.length})`, icon: "👥" },
                      { id: "tiers", label: "Tiers & pricing", icon: "💎" },
                      { id: "storage", label: "Storage", icon: "💾" },
                      { id: "conversions", label: "Conversions", icon: "⚙️" },
                      { id: "health", label: "Health", icon: "❤️" },
                      { id: "usage", label: "Usage", icon: "📈" },
                      { id: "site", label: "Site", icon: "🎨" },
                    ].map((item) => (
                      <li>
                        <a
                          href={`${WEBROOT}/admin?tab=${item.id}`}
                          aria-current={currentTab === item.id ? "page" : undefined}
                          class={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                            currentTab === item.id
                              ? "bg-cta font-bold text-cta-ink shadow"
                              : "font-medium text-ink-body hover:bg-surface-2 hover:text-ink"
                          }`}
                        >
                          <span aria-hidden="true">{item.icon}</span>
                          <span safe>{item.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div class="min-w-0 flex-1">
                  {/* TAB 1: OVERVIEW */}
                  {currentTab === "overview" && (
                    <div class="space-y-8">
                      {/* Stat Cards */}
                      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        <div class="rounded-2xl border border-rule bg-surface p-6 shadow-sm backdrop-blur">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              Total Users
                            </span>
                            <span class="rounded-lg bg-sky/40 p-2 text-ink">👥</span>
                          </div>
                          <div class="text-3xl font-extrabold text-ink">{stats.totalUsers}</div>
                          <p class="mt-1 text-xs text-ink-muted">Registered accounts in database</p>
                        </div>

                        <div class="rounded-2xl border border-rule bg-surface p-6 shadow-sm backdrop-blur">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              Pro & Business
                            </span>
                            <span class="rounded-lg bg-cta/10 p-2 text-ink">💎</span>
                          </div>
                          <div class="text-3xl font-extrabold text-ink">{stats.proUsers}</div>
                          <p class="mt-1 text-xs text-ink-muted">Active paying / promoted tiers</p>
                        </div>

                        <div class="rounded-2xl border border-rule bg-surface p-6 shadow-sm backdrop-blur">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              Total Jobs
                            </span>
                            <span class="rounded-lg bg-sapphire/15 p-2 text-ink">⚡</span>
                          </div>
                          <div class="text-3xl font-extrabold text-ink">{stats.totalJobs}</div>
                          <p class="mt-1 text-xs text-ink-muted">Conversion sessions executed</p>
                        </div>

                        <div class="rounded-2xl border border-rule bg-surface p-6 shadow-sm backdrop-blur">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              Files Converted
                            </span>
                            <span class="rounded-lg bg-forest/10 p-2 text-forest">📄</span>
                          </div>
                          <div class="text-3xl font-extrabold text-ink">{stats.totalFiles}</div>
                          <p class="mt-1 text-xs text-ink-muted">Individual outputs produced</p>
                        </div>
                      </div>

                      {/* Quick Management Shortcuts */}
                      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Quick Actions */}
                        <div class="rounded-2xl border border-rule bg-surface p-6 shadow-sm">
                          <h3 class="text-lg font-bold text-ink mb-4">Quick Tier Control</h3>
                          <p class="text-sm text-ink-muted mb-6">
                            Instantly manage user tiers, grant Pro access, or adjust global
                            conversion quotas.
                          </p>
                          <div class="flex flex-wrap gap-3">
                            <a
                              href={`${WEBROOT}/admin?tab=users`}
                              class="btn-primary text-xs font-bold px-4 py-2.5 flex items-center gap-2"
                            >
                              <span>👤</span> Manage All Users
                            </a>
                            <a
                              href={`${WEBROOT}/admin?tab=tiers`}
                              class="btn-secondary text-xs font-bold px-4 py-2.5 flex items-center gap-2"
                            >
                              <span>⚙️</span> Customize Tier Features
                            </a>
                          </div>
                        </div>

                        {/* Right: Engine Status */}
                        <div class="rounded-2xl border border-rule bg-surface/60 p-6">
                          <h3 class="text-lg font-bold text-ink mb-4">System & Engine Status</h3>
                          <div class="space-y-3 text-sm">
                            <div class="flex items-center justify-between py-2 border-b border-rule">
                              <span class="text-ink-muted">Runtime Engine</span>
                              <span class="font-mono text-xs text-ink font-semibold">
                                Bun v1.4.2 (Native)
                              </span>
                            </div>
                            <div class="flex items-center justify-between py-2 border-b border-rule">
                              <span class="text-ink-muted">Database</span>
                              <span class="font-mono text-xs text-forest font-semibold">
                                SQLite (WAL Mode Enabled)
                              </span>
                            </div>
                            <div class="flex items-center justify-between py-2 border-b border-rule">
                              <span class="text-ink-muted">Public Access</span>
                              <span class="font-mono text-xs text-link font-semibold">
                                {ALLOW_UNAUTHENTICATED
                                  ? "Unauthenticated Allowed"
                                  : "Auth Required"}
                              </span>
                            </div>
                            <div class="flex items-center justify-between py-2">
                              <span class="text-ink-muted">Admin Account</span>
                              <span class="font-mono text-xs text-ink-muted font-semibold">
                                {currentUser.email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: USER MANAGEMENT */}
                  {currentTab === "users" && (
                    <div class="space-y-6">
                      <div class="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h2 class="text-2xl font-bold text-ink">Database Users</h2>
                          <p class="text-sm text-ink-muted">
                            Inspect all users, modify their subscription tiers, and toggle
                            administrative rights.
                          </p>
                        </div>
                        <span class="rounded-lg bg-surface-2 px-3 py-1 text-xs text-ink-body font-medium">
                          Total Users: {users.length}
                        </span>
                      </div>

                      {/* Users Table */}
                      <div class="overflow-x-auto rounded-2xl border border-rule bg-surface/70 backdrop-blur shadow-xl">
                        <table class="w-full text-left text-sm text-ink-body">
                          <thead class="border-b border-rule bg-surface-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            <tr>
                              <th class="p-4">ID</th>
                              <th class="p-4">Email</th>
                              <th class="p-4">Role</th>
                              <th class="p-4">Current Tier</th>
                              <th class="p-4">Total Jobs</th>
                              <th class="p-4 text-right">Quick Tier Control</th>
                              <th class="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-rule">
                            {users.map((u) => (
                              <tr class="hover:bg-surface-2 transition-colors">
                                <td class="p-4 font-mono text-xs text-ink-muted">{u.id}</td>
                                <td class="p-4 font-medium text-ink">
                                  <div class="flex items-center gap-2.5">
                                    {u.avatar_path ? (
                                      <img
                                        src={`${WEBROOT}/avatar/${u.id}`}
                                        alt=""
                                        width="28"
                                        height="28"
                                        class="size-7 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <span class="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-[10px] font-bold text-ink-body">
                                        {initialsOf(u.display_name, u.email)}
                                      </span>
                                    )}
                                    <span class="flex flex-col">
                                      <span safe>{u.display_name || u.email}</span>
                                      {u.display_name ? (
                                        <span class="text-[11px] font-normal text-ink-muted" safe>
                                          {u.email}
                                        </span>
                                      ) : null}
                                    </span>
                                    {u.google_id ? (
                                      <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-body">
                                        Google
                                      </span>
                                    ) : null}
                                    {u.id === currentUser.id && (
                                      <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink">
                                        YOU
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td class="p-4">
                                  <form
                                    method="post"
                                    action={`${WEBROOT}/admin/users/${u.id}/role`}
                                  >
                                    <input
                                      type="hidden"
                                      name="role"
                                      value={u.role === "admin" ? "user" : "admin"}
                                    />
                                    <button
                                      type="submit"
                                      class={`rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                        u.role === "admin"
                                          ? "bg-marigold/25 text-ink-muted border border-marigold/50 hover:bg-marigold/30"
                                          : "bg-surface-2 text-ink-muted border border-rule hover:bg-surface-2"
                                      }`}
                                    >
                                      {u.role === "admin" ? "⚡ Admin" : "User"}
                                    </button>
                                  </form>
                                </td>
                                <td class="p-4">
                                  <span
                                    class={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                                      u.tier === "pro"
                                        ? "bg-surface-2 text-ink border border-cta/40"
                                        : u.tier === "business"
                                          ? "bg-sky/40 text-ink border border-rule"
                                          : "bg-surface-2 text-ink-muted border border-rule"
                                    }`}
                                  >
                                    {u.tier}
                                  </span>
                                </td>
                                <td class="p-4 font-mono text-xs text-ink-body">{u.jobs_count}</td>

                                {/* Change Tier Form */}
                                <td class="p-4 text-right">
                                  <form
                                    method="post"
                                    action={`${WEBROOT}/admin/users/${u.id}/tier`}
                                    class="inline-flex items-center gap-2"
                                  >
                                    <select
                                      name="tier"
                                      class="rounded-lg bg-surface-2 border border-rule px-2.5 py-1 text-xs text-ink focus:outline-none focus:border-cta cursor-pointer"
                                    >
                                      <option value="free" selected={u.tier === "free"}>
                                        Free
                                      </option>
                                      <option value="pro" selected={u.tier === "pro"}>
                                        ConvertX Pro
                                      </option>
                                      <option value="business" selected={u.tier === "business"}>
                                        Business & API
                                      </option>
                                    </select>
                                    <button
                                      type="submit"
                                      class="rounded-lg bg-cta px-3 py-1 text-xs font-bold text-cta-ink hover:bg-cta transition-colors cursor-pointer"
                                    >
                                      Apply
                                    </button>
                                  </form>
                                </td>

                                {/* Delete Action */}
                                <td class="p-4 text-right">
                                  {u.id !== currentUser.id ? (
                                    <form
                                      method="post"
                                      action={`${WEBROOT}/admin/users/${u.id}/delete`}
                                      onsubmit="return confirm('Are you sure you want to delete this user? All their conversion jobs will be permanently removed.');"
                                    >
                                      <button
                                        type="submit"
                                        class="rounded-lg border border-terracotta/30 bg-terracotta/10 px-2.5 py-1 text-xs font-semibold text-terracotta hover:bg-terracotta/20 transition-colors cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </form>
                                  ) : (
                                    <span class="text-xs text-ink-muted">Protected</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TIER MANAGEMENT & UI DESIGN CONTROL */}
                  {currentTab === "tiers" && (
                    <div class="space-y-8">
                      <div>
                        <h2 class="text-2xl font-bold text-ink">
                          Tier Management & UI Design Studio
                        </h2>
                        <p class="text-sm text-ink-muted">
                          Customize pricing, quotas, features, and visual badges. Changes reflect
                          live on the homepage pricing section immediately.
                        </p>
                      </div>

                      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {tiers.map((t) => {
                          let featuresList: string[];
                          try {
                            featuresList = JSON.parse(t.features);
                          } catch {
                            featuresList = t.features.split("\n");
                          }

                          return (
                            <div
                              class={`rounded-3xl border bg-surface/80 p-6 flex flex-col justify-between shadow-2xl transition-all ${
                                t.is_popular
                                  ? "border-2 border-cta shadow-accent-500/10"
                                  : "border-rule"
                              }`}
                            >
                              <form
                                method="post"
                                action={`${WEBROOT}/admin/tiers/${t.id}`}
                                class="space-y-4"
                              >
                                <div class="flex items-center justify-between">
                                  <span class="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-mono font-bold text-ink-muted uppercase">
                                    ID: {t.id}
                                  </span>
                                  {t.is_popular ? (
                                    <span class="rounded-full bg-cta px-3 py-0.5 text-[10px] font-extrabold text-cta-ink uppercase">
                                      Popular Card
                                    </span>
                                  ) : null}
                                </div>

                                {/* Tier Name */}
                                <div>
                                  <label class="block text-xs font-semibold text-ink-muted mb-1">
                                    Tier Name
                                  </label>
                                  <input
                                    type="text"
                                    name="name"
                                    value={t.name}
                                    required
                                    class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm font-bold text-ink focus:outline-none focus:border-cta"
                                  />
                                </div>

                                {/* Price & Billing Period */}
                                <div class="grid grid-cols-2 gap-2">
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Price
                                    </label>
                                    <input
                                      type="text"
                                      name="price"
                                      value={t.price}
                                      required
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm font-bold text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Period
                                    </label>
                                    <input
                                      type="text"
                                      name="billing_period"
                                      value={t.billing_period}
                                      required
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                </div>

                                {/* Badge text */}
                                <div>
                                  <label class="block text-xs font-semibold text-ink-muted mb-1">
                                    Badge Text
                                  </label>
                                  <input
                                    type="text"
                                    name="badge"
                                    value={t.badge}
                                    placeholder="e.g. Most Popular"
                                    class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm text-ink focus:outline-none focus:border-cta"
                                  />
                                </div>

                                {/* Description */}
                                <div>
                                  <label class="block text-xs font-semibold text-ink-muted mb-1">
                                    Short Description
                                  </label>
                                  <input
                                    type="text"
                                    name="description"
                                    value={t.description}
                                    required
                                    class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-xs text-ink-body focus:outline-none focus:border-cta"
                                  />
                                </div>

                                {/* Max File Size MB & Daily Limit */}
                                <div class="grid grid-cols-2 gap-2">
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Max File (MB)
                                    </label>
                                    <input
                                      type="number"
                                      name="max_file_size_mb"
                                      value={String(t.max_file_size_mb)}
                                      required
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Daily Limit
                                    </label>
                                    <input
                                      type="number"
                                      name="daily_conversions"
                                      value={String(t.daily_conversions)}
                                      required
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                </div>

                                {/* Batch Limit, Priority & Retention */}
                                <div class="grid grid-cols-3 gap-2">
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Batch Files
                                    </label>
                                    <input
                                      type="number"
                                      name="batch_limit"
                                      value={String(t.batch_limit)}
                                      required
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Priority Queue
                                    </label>
                                    <select
                                      name="priority_queue"
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-2 py-2 text-sm text-ink focus:outline-none focus:border-cta"
                                    >
                                      <option value="0" selected={t.priority_queue === 0}>
                                        Standard
                                      </option>
                                      <option value="1" selected={t.priority_queue === 1}>
                                        Priority
                                      </option>
                                      <option value="2" selected={t.priority_queue === 2}>
                                        Highest
                                      </option>
                                    </select>
                                  </div>
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Retention (h)
                                    </label>
                                    <input
                                      type="number"
                                      name="retention_hours"
                                      value={String(t.retention_hours ?? 2)}
                                      required
                                      min="1"
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                </div>

                                {/* Popular Card Toggle */}
                                <div class="flex items-center gap-2 pt-1">
                                  <input
                                    type="checkbox"
                                    name="is_popular"
                                    id={`popular_${t.id}`}
                                    value="1"
                                    checked={Boolean(t.is_popular)}
                                    class="size-4 rounded accent-accent-500 cursor-pointer"
                                  />
                                  <label
                                    for={`popular_${t.id}`}
                                    class="text-xs font-semibold text-ink-body cursor-pointer"
                                  >
                                    Highlight as "Most Popular" card
                                  </label>
                                </div>

                                {/* Feature lines */}
                                <div>
                                  <label class="block text-xs font-semibold text-ink-muted mb-1">
                                    Features List (1 per line)
                                  </label>
                                  <textarea
                                    name="features"
                                    rows="5"
                                    class="w-full rounded-xl bg-surface-2 border border-rule p-3 text-xs font-mono text-ink-body focus:outline-none focus:border-cta"
                                  >
                                    {featuresList.join("\n")}
                                  </textarea>
                                </div>

                                {/* Button Text & Link */}
                                <div class="grid grid-cols-2 gap-2">
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Button Text
                                    </label>
                                    <input
                                      type="text"
                                      name="button_text"
                                      value={t.button_text}
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-xs text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                  <div>
                                    <label class="block text-xs font-semibold text-ink-muted mb-1">
                                      Button Link
                                    </label>
                                    <input
                                      type="text"
                                      name="button_link"
                                      value={t.button_link}
                                      class="w-full rounded-xl bg-surface-2 border border-rule px-3 py-2 text-xs text-ink focus:outline-none focus:border-cta"
                                    />
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  class="btn-primary w-full py-3 text-center text-xs font-bold uppercase tracking-wider shadow-lg"
                                >
                                  Save Changes Live 💾
                                </button>
                              </form>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentTab === "storage" && (
                    <StoragePanel
                      usage={storageUsage()}
                      webroot={WEBROOT}
                      cleanup={{
                        enabled: cleanupEnabled(),
                        overrideHours: cleanupOverrideHours(),
                        choices: CLEANUP_INTERVAL_CHOICES,
                      }}
                    />
                  )}

                  {currentTab === "conversions" && (
                    <ConversionsPanel
                      webroot={WEBROOT}
                      snapshot={queueSnapshot({
                        status: query.status,
                        format: query.format,
                        owner: query.owner,
                        limit: query.limit ? Number(query.limit) : undefined,
                      })}
                    />
                  )}

                  {currentTab === "health" && (
                    <HealthPanel
                      health={systemHealth([
                        {
                          label: "Payments (Paddle)",
                          value: PADDLE_ENABLED ? "on" : "not configured",
                        },
                        {
                          label: "Sign in with Google",
                          value: GOOGLE_ENABLED ? "on" : "not configured",
                        },
                        {
                          label: "Accounts open to sign-up",
                          value: ACCOUNT_REGISTRATION ? "yes" : "no",
                        },
                        {
                          label: "Visitors may convert",
                          value: ALLOW_UNAUTHENTICATED ? "yes" : "no",
                        },
                      ])}
                    />
                  )}

                  {currentTab === "usage" && <AnalyticsPanel data={analytics()} />}

                  {currentTab === "site" && (
                    <SitePanel
                      webroot={WEBROOT}
                      logoUrl={brandingUrl(WEBROOT, "logo")}
                      faviconUrl={brandingUrl(WEBROOT, "favicon")}
                      siteName={siteName()}
                      siteTagline={siteTagline()}
                      formats={formatCatalogue()}
                      usage={formatUsage()}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        </BaseHtml>
      );
    },
    {
      query: t.Object({
        tab: t.Optional(t.String()),
        msg: t.Optional(t.String()),
        // Recent-jobs filters, kept in the URL so a filtered view survives a reload
        status: t.Optional(t.String()),
        format: t.Optional(t.String()),
        owner: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      cookie: t.Cookie({
        auth: t.Optional(t.String()),
      }),
    },
  )
  // Update User Tier Action
  .post(
    "/users/:id/tier",
    async ({ params, body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      updateUserTier(params.id, body.tier);
      return redirect(
        `${WEBROOT}/admin?tab=users&msg=User+tier+updated+to+${encodeURIComponent(body.tier)}`,
        302,
      );
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        tier: t.String(),
      }),
      cookie: t.Cookie({
        auth: t.Optional(t.String()),
      }),
    },
  )
  // Update User Role Action
  .post(
    "/users/:id/role",
    async ({ params, body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      updateUserRole(params.id, body.role);
      return redirect(
        `${WEBROOT}/admin?tab=users&msg=User+role+updated+to+${encodeURIComponent(body.role)}`,
        302,
      );
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        role: t.String(),
      }),
      cookie: t.Cookie({
        auth: t.Optional(t.String()),
      }),
    },
  )
  // Delete User Action
  .post(
    "/users/:id/delete",
    async ({ params, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      if (String(params.id) === String(adminUser.id)) {
        return redirect(`${WEBROOT}/admin?tab=users&msg=Cannot+delete+your+own+admin+account`, 302);
      }

      deleteUserById(params.id);
      return redirect(`${WEBROOT}/admin?tab=users&msg=User+deleted+successfully`, 302);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      cookie: t.Cookie({
        auth: t.Optional(t.String()),
      }),
    },
  )
  // Update Tier & UI Design Action
  .post(
    "/tiers/:id",
    async ({ params, body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      const featuresArray = body.features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      updateTier({
        id: params.id,
        name: body.name,
        price: body.price,
        billing_period: body.billing_period,
        description: body.description,
        max_file_size_mb: Number(body.max_file_size_mb),
        daily_conversions: Number(body.daily_conversions),
        batch_limit: Number(body.batch_limit),
        priority_queue: Number(body.priority_queue),
        is_popular: body.is_popular ? 1 : 0,
        badge: body.badge || "",
        features: JSON.stringify(featuresArray),
        button_text: body.button_text,
        button_link: body.button_link,
        retention_hours: Number(body.retention_hours || 2),
      });

      return redirect(
        `${WEBROOT}/admin?tab=tiers&msg=Tier+${encodeURIComponent(params.id)}+updated+successfully`,
        302,
      );
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.String(),
        price: t.String(),
        billing_period: t.String(),
        description: t.String(),
        max_file_size_mb: t.String(),
        daily_conversions: t.String(),
        batch_limit: t.String(),
        priority_queue: t.String(),
        is_popular: t.Optional(t.String()),
        badge: t.Optional(t.String()),
        features: t.String(),
        button_text: t.String(),
        button_link: t.String(),
        retention_hours: t.Optional(t.String()),
      }),
      cookie: t.Cookie({
        auth: t.Optional(t.String()),
      }),
    },
  )
  // Run the retention sweep by hand, for when the volume needs space now
  .post(
    "/storage/cleanup",
    async ({ jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      const removed = deleteExpiredJobs();
      // Files uploaded for a conversion nobody started are storage too, and the button
      // says "delete expired", not "delete expired jobs"
      const orphans = deleteOrphanedUploads();
      const message =
        orphans > 0
          ? `Cleanup removed ${removed} expired job${removed === 1 ? "" : "s"} and ${orphans} abandoned upload${orphans === 1 ? "" : "s"}`
          : `Cleanup removed ${removed} expired job${removed === 1 ? "" : "s"}`;
      return redirect(`${WEBROOT}/admin?tab=storage&msg=${encodeURIComponent(message)}`, 302);
    },
    {
      cookie: t.Cookie({
        auth: t.Optional(t.String()),
      }),
    },
  )
  // Logo and favicon uploads
  .post(
    "/branding/:asset",
    async ({ params, body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);
      if (params.asset !== "logo" && params.asset !== "favicon") {
        return redirect(`${WEBROOT}/admin?tab=site`, 302);
      }

      const failure = await saveBrandingAsset(params.asset, body.image);
      const message =
        failure === "type"
          ? "That file type cannot be used"
          : failure === "size"
            ? "That image is larger than 1 MB"
            : `${params.asset === "logo" ? "Logo" : "Favicon"} updated`;
      return redirect(`${WEBROOT}/admin?tab=site&msg=${encodeURIComponent(message)}`, 302);
    },
    {
      params: t.Object({ asset: t.String() }),
      body: t.Object({ image: t.File() }),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  )
  .post(
    "/branding/:asset/delete",
    async ({ params, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);
      if (params.asset !== "logo" && params.asset !== "favicon") {
        return redirect(`${WEBROOT}/admin?tab=site`, 302);
      }

      await removeBrandingAsset(params.asset);
      return redirect(`${WEBROOT}/admin?tab=site&msg=Using+the+built-in+artwork+again`, 302);
    },
    {
      params: t.Object({ asset: t.String() }),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  )
  // Which output formats the site offers, and the tool chosen for each
  .post(
    "/site/formats",
    async ({ body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      const catalogue = formatCatalogue();

      // "Offer every format" ignores the boxes and turns the lot back on
      const ticked = body.all
        ? catalogue.map((row) => row.format)
        : (Array.isArray(body.format) ? body.format : body.format ? [body.format] : []).map(
            (format) => format.toLowerCase(),
          );

      setOfferedFormats(ticked);

      // The selects arrive as converter.<format>; setPreferredConverters checks each name
      // against the converters that really produce that format before storing it
      const choices: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (key.startsWith("converter.") && typeof value === "string") {
          choices[key.slice("converter.".length)] = value;
        }
      }
      setPreferredConverters(choices);

      const message = `${ticked.length} of ${catalogue.length} formats offered`;
      return redirect(`${WEBROOT}/admin?tab=site&msg=${encodeURIComponent(message)}`, 302);
    },
    {
      // The per-row converter selects are named dynamically, so extra keys are expected
      body: t.Object(
        {
          format: t.Optional(t.Union([t.String(), t.Array(t.String())])),
          all: t.Optional(t.String()),
        },
        { additionalProperties: true },
      ),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  )
  // Bulk delete from the recent-jobs table. Unlike a user deleting their own history, this
  // is not scoped to an owner: an admin may remove anybody's job.
  .post(
    "/conversions/delete",
    async ({ body, jwt, set, cookie: { auth } }) => {
      if (!auth?.value) {
        set.status = 401;
        return { success: false, message: "Not signed in" };
      }
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      const adminUser = verified && verified.id ? getUserById(verified.id) : null;
      if (!adminUser || adminUser.role !== "admin") {
        set.status = 403;
        return { success: false, message: "Not an admin" };
      }

      if (body.jobIds.length === 0) {
        set.status = 400;
        return { success: false, message: "No jobs selected" };
      }

      const placeholders = body.jobIds.map(() => "?").join(", ");
      const jobs = db
        .query(`SELECT id, user_id FROM jobs WHERE id IN (${placeholders})`)
        .all(...body.jobIds) as { id: number; user_id: number }[];

      return { success: true, deleted: deleteJobs(jobs) };
    },
    {
      body: t.Object({ jobIds: t.Array(t.String()) }),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  )
  // The name shown in the header
  .post(
    "/site/name",
    async ({ body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      setSiteName(body.siteName ?? "");
      setSiteTagline(body.siteTagline ?? "");

      return redirect(`${WEBROOT}/admin?tab=site&msg=Site+name+updated`, 302);
    },
    {
      body: t.Object({
        siteName: t.Optional(t.String()),
        siteTagline: t.Optional(t.String()),
      }),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  )
  // When, and whether, files are deleted automatically
  .post(
    "/storage/schedule",
    async ({ body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      const enabled = Boolean(body.enabled);
      setCleanupEnabled(enabled);

      const hours = Number(body.hours);
      const override = CLEANUP_INTERVAL_CHOICES.includes(hours) ? hours : null;
      setCleanupOverrideHours(override);

      const message = !enabled
        ? "Automatic deletion is off"
        : override === null
          ? "Files follow each plan's own window"
          : `Files are deleted after ${override} hours for everyone`;
      return redirect(`${WEBROOT}/admin?tab=storage&msg=${encodeURIComponent(message)}`, 302);
    },
    {
      body: t.Object({
        hours: t.Optional(t.String()),
        enabled: t.Optional(t.String()),
      }),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  )
  // Everything, expired or not. There is no undo, so the form asks first.
  .post(
    "/storage/purge",
    async ({ jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      const removed = purgeAllJobs();
      console.warn(`Admin ${adminUser.email} deleted all stored files (${removed} job(s)).`);
      return redirect(
        `${WEBROOT}/admin?tab=storage&msg=${encodeURIComponent(
          `Deleted every stored file (${removed} job${removed === 1 ? "" : "s"})`,
        )}`,
        302,
      );
    },
    {
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  );
