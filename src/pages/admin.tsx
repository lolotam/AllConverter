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
import {
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
import { onlyAvailable } from "../converters/availability";
import { getAllTargets } from "../converters/main";
import { analytics, queueSnapshot, storageUsage, systemHealth } from "../services/adminStats";
import { brandingUrl, removeBrandingAsset, saveBrandingAsset } from "../services/branding";
import { initialsOf } from "../services/avatar";
import { hiddenConverters, setHiddenConverters } from "../services/features";
import { deleteExpiredJobs } from "../services/cleanup";
import { GOOGLE_ENABLED } from "../services/google";
import { PADDLE_ENABLED } from "../services/paddle";
import { userService } from "../services/user";

/** Every converter whose tools are installed, and whether the site currently offers it. */
function converterVisibility(): { name: string; formats: number; visible: boolean }[] {
  const hidden = new Set(hiddenConverters());
  return Object.entries(onlyAvailable(getAllTargets()))
    .map(([name, targets]) => ({
      name,
      formats: Array.isArray(targets) ? targets.length : 0,
      visible: !hidden.has(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
            <div class="mx-auto my-20 max-w-md rounded-2xl border border-red-500/30 bg-neutral-900 p-8 text-center shadow-2xl">
              <div class="mb-4 text-5xl">🚫</div>
              <h1 class="text-2xl font-bold text-white mb-2">Access Denied</h1>
              <p class="text-neutral-400 text-sm mb-6">
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
              isAdmin={true}
            />

            <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b0c10] dark:text-neutral-100 transition-colors">
              {/* Dashboard Sub-header */}
              <div class="border-b border-slate-200 bg-white/90 dark:border-neutral-800 dark:bg-neutral-950/60 backdrop-blur px-4 py-4 sm:px-8">
                <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div class="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xl font-bold">
                      ⚡
                    </div>
                    <div>
                      <h1 class="text-xl font-black text-slate-900 dark:text-white">
                        Admin Command Center
                      </h1>
                      <p class="text-xs text-slate-500 dark:text-neutral-400">
                        Manage users, configure subscription tiers, and control system UI
                      </p>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div class="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-1 text-sm font-medium">
                    <a
                      href={`${WEBROOT}/admin?tab=overview`}
                      class={`rounded-lg px-4 py-1.5 transition-all ${
                        currentTab === "overview"
                          ? "bg-accent-500 text-neutral-950 font-bold shadow"
                          : "text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
                      }`}
                    >
                      📊 Overview
                    </a>
                    <a
                      href={`${WEBROOT}/admin?tab=users`}
                      class={`rounded-lg px-4 py-1.5 transition-all ${
                        currentTab === "users"
                          ? "bg-accent-500 text-neutral-950 font-bold shadow"
                          : "text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
                      }`}
                    >
                      👥 Users ({users.length})
                    </a>
                    <a
                      href={`${WEBROOT}/admin?tab=tiers`}
                      class={`rounded-lg px-4 py-1.5 transition-all ${
                        currentTab === "tiers"
                          ? "bg-accent-500 text-neutral-950 font-bold shadow"
                          : "text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
                      }`}
                    >
                      💎 Tiers & UI Design
                    </a>
                    {[
                      { id: "storage", label: "💾 Storage" },
                      { id: "conversions", label: "⚙️ Conversions" },
                      { id: "health", label: "❤️ Health" },
                      { id: "usage", label: "📈 Usage" },
                      { id: "site", label: "🎨 Site" },
                    ].map((tab) => (
                      <a
                        href={`${WEBROOT}/admin?tab=${tab.id}`}
                        class={`rounded-lg px-4 py-1.5 transition-all ${
                          currentTab === tab.id
                            ? "bg-accent-500 text-neutral-950 font-bold shadow"
                            : "text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notification Banner */}
              {message && (
                <div class="mx-auto max-w-7xl px-4 pt-4 sm:px-8">
                  <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-between">
                    <span>✓ {message}</span>
                    <a
                      href={`${WEBROOT}/admin?tab=${currentTab}`}
                      class="text-xs text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white"
                    >
                      ✕
                    </a>
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              <div class="mx-auto max-w-7xl px-4 py-8 sm:px-8">
                {/* TAB 1: OVERVIEW */}
                {currentTab === "overview" && (
                  <div class="space-y-8">
                    {/* Stat Cards */}
                    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70 backdrop-blur">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                            Total Users
                          </span>
                          <span class="rounded-lg bg-blue-500/10 p-2 text-blue-500">👥</span>
                        </div>
                        <div class="text-3xl font-extrabold text-slate-900 dark:text-white">
                          {stats.totalUsers}
                        </div>
                        <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                          Registered accounts in database
                        </p>
                      </div>

                      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70 backdrop-blur">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                            Pro & Business
                          </span>
                          <span class="rounded-lg bg-accent-500/10 p-2 text-lime-600 dark:text-accent-400">
                            💎
                          </span>
                        </div>
                        <div class="text-3xl font-extrabold text-lime-600 dark:text-accent-400">
                          {stats.proUsers}
                        </div>
                        <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                          Active paying / promoted tiers
                        </p>
                      </div>

                      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70 backdrop-blur">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                            Total Jobs
                          </span>
                          <span class="rounded-lg bg-purple-500/10 p-2 text-purple-500">⚡</span>
                        </div>
                        <div class="text-3xl font-extrabold text-slate-900 dark:text-white">
                          {stats.totalJobs}
                        </div>
                        <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                          Conversion sessions executed
                        </p>
                      </div>

                      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70 backdrop-blur">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                            Files Converted
                          </span>
                          <span class="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">📄</span>
                        </div>
                        <div class="text-3xl font-extrabold text-slate-900 dark:text-white">
                          {stats.totalFiles}
                        </div>
                        <p class="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                          Individual outputs produced
                        </p>
                      </div>
                    </div>

                    {/* Quick Management Shortcuts */}
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Quick Actions */}
                      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-4">
                          Quick Tier Control
                        </h3>
                        <p class="text-sm text-slate-600 dark:text-neutral-400 mb-6">
                          Instantly manage user tiers, grant Pro access, or adjust global conversion
                          quotas.
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
                      <div class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
                        <h3 class="text-lg font-bold text-white mb-4">System & Engine Status</h3>
                        <div class="space-y-3 text-sm">
                          <div class="flex items-center justify-between py-2 border-b border-neutral-800">
                            <span class="text-neutral-400">Runtime Engine</span>
                            <span class="font-mono text-xs text-accent-400 font-semibold">
                              Bun v1.4.2 (Native)
                            </span>
                          </div>
                          <div class="flex items-center justify-between py-2 border-b border-neutral-800">
                            <span class="text-neutral-400">Database</span>
                            <span class="font-mono text-xs text-emerald-400 font-semibold">
                              SQLite (WAL Mode Enabled)
                            </span>
                          </div>
                          <div class="flex items-center justify-between py-2 border-b border-neutral-800">
                            <span class="text-neutral-400">Public Access</span>
                            <span class="font-mono text-xs text-blue-400 font-semibold">
                              {ALLOW_UNAUTHENTICATED ? "Unauthenticated Allowed" : "Auth Required"}
                            </span>
                          </div>
                          <div class="flex items-center justify-between py-2">
                            <span class="text-neutral-400">Admin Account</span>
                            <span class="font-mono text-xs text-amber-400 font-semibold">
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
                        <h2 class="text-2xl font-bold text-white">Database Users</h2>
                        <p class="text-sm text-neutral-400">
                          Inspect all users, modify their subscription tiers, and toggle
                          administrative rights.
                        </p>
                      </div>
                      <span class="rounded-lg bg-neutral-800 px-3 py-1 text-xs text-neutral-300 font-medium">
                        Total Users: {users.length}
                      </span>
                    </div>

                    {/* Users Table */}
                    <div class="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur shadow-xl">
                      <table class="w-full text-left text-sm text-neutral-300">
                        <thead class="border-b border-neutral-800 bg-neutral-950/80 text-xs font-semibold uppercase tracking-wider text-neutral-400">
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
                        <tbody class="divide-y divide-neutral-800/60">
                          {users.map((u) => (
                            <tr class="hover:bg-neutral-850/50 transition-colors">
                              <td class="p-4 font-mono text-xs text-neutral-400">{u.id}</td>
                              <td class="p-4 font-medium text-white">
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
                                    <span class="flex size-7 items-center justify-center rounded-lg bg-neutral-800 text-[10px] font-bold text-neutral-300">
                                      {initialsOf(u.display_name, u.email)}
                                    </span>
                                  )}
                                  <span class="flex flex-col">
                                    <span safe>{u.display_name || u.email}</span>
                                    {u.display_name ? (
                                      <span class="text-[11px] font-normal text-neutral-400" safe>
                                        {u.email}
                                      </span>
                                    ) : null}
                                  </span>
                                  {u.google_id ? (
                                    <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-neutral-300">
                                      Google
                                    </span>
                                  ) : null}
                                  {u.id === currentUser.id && (
                                    <span class="rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-400">
                                      YOU
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td class="p-4">
                                <form method="post" action={`${WEBROOT}/admin/users/${u.id}/role`}>
                                  <input
                                    type="hidden"
                                    name="role"
                                    value={u.role === "admin" ? "user" : "admin"}
                                  />
                                  <button
                                    type="submit"
                                    class={`rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                      u.role === "admin"
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                                        : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700"
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
                                      ? "bg-accent-500/20 text-accent-400 border border-accent-500/40"
                                      : u.tier === "business"
                                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                                        : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                                  }`}
                                >
                                  {u.tier}
                                </span>
                              </td>
                              <td class="p-4 font-mono text-xs text-neutral-300">{u.jobs_count}</td>

                              {/* Change Tier Form */}
                              <td class="p-4 text-right">
                                <form
                                  method="post"
                                  action={`${WEBROOT}/admin/users/${u.id}/tier`}
                                  class="inline-flex items-center gap-2"
                                >
                                  <select
                                    name="tier"
                                    class="rounded-lg bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent-500 cursor-pointer"
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
                                    class="rounded-lg bg-accent-500 px-3 py-1 text-xs font-bold text-neutral-950 hover:bg-accent-400 transition-colors cursor-pointer"
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
                                      class="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </form>
                                ) : (
                                  <span class="text-xs text-neutral-500">Protected</span>
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
                      <h2 class="text-2xl font-bold text-white">
                        Tier Management & UI Design Studio
                      </h2>
                      <p class="text-sm text-neutral-400">
                        Customize pricing, quotas, features, and visual badges. Changes reflect live
                        on the homepage pricing section immediately.
                      </p>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {tiers.map((t) => {
                        let featuresList: string[] = [];
                        try {
                          featuresList = JSON.parse(t.features);
                        } catch {
                          featuresList = t.features.split("\n");
                        }

                        return (
                          <div
                            class={`rounded-3xl border bg-neutral-900/80 p-6 flex flex-col justify-between shadow-2xl transition-all ${
                              t.is_popular
                                ? "border-2 border-accent-500 shadow-accent-500/10"
                                : "border-neutral-800"
                            }`}
                          >
                            <form
                              method="post"
                              action={`${WEBROOT}/admin/tiers/${t.id}`}
                              class="space-y-4"
                            >
                              <div class="flex items-center justify-between">
                                <span class="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-mono font-bold text-neutral-400 uppercase">
                                  ID: {t.id}
                                </span>
                                {t.is_popular ? (
                                  <span class="rounded-full bg-accent-500 px-3 py-0.5 text-[10px] font-extrabold text-neutral-950 uppercase">
                                    Popular Card
                                  </span>
                                ) : null}
                              </div>

                              {/* Tier Name */}
                              <div>
                                <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                  Tier Name
                                </label>
                                <input
                                  type="text"
                                  name="name"
                                  value={t.name}
                                  required
                                  class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-accent-500"
                                />
                              </div>

                              {/* Price & Billing Period */}
                              <div class="grid grid-cols-2 gap-2">
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Price
                                  </label>
                                  <input
                                    type="text"
                                    name="price"
                                    value={t.price}
                                    required
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-accent-500"
                                  />
                                </div>
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Period
                                  </label>
                                  <input
                                    type="text"
                                    name="billing_period"
                                    value={t.billing_period}
                                    required
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                                  />
                                </div>
                              </div>

                              {/* Badge text */}
                              <div>
                                <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                  Badge Text
                                </label>
                                <input
                                  type="text"
                                  name="badge"
                                  value={t.badge}
                                  placeholder="e.g. Most Popular"
                                  class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                                />
                              </div>

                              {/* Description */}
                              <div>
                                <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                  Short Description
                                </label>
                                <input
                                  type="text"
                                  name="description"
                                  value={t.description}
                                  required
                                  class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-accent-500"
                                />
                              </div>

                              {/* Max File Size MB & Daily Limit */}
                              <div class="grid grid-cols-2 gap-2">
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Max File (MB)
                                  </label>
                                  <input
                                    type="number"
                                    name="max_file_size_mb"
                                    value={String(t.max_file_size_mb)}
                                    required
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent-500"
                                  />
                                </div>
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Daily Limit
                                  </label>
                                  <input
                                    type="number"
                                    name="daily_conversions"
                                    value={String(t.daily_conversions)}
                                    required
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent-500"
                                  />
                                </div>
                              </div>

                              {/* Batch Limit & Priority */}
                              <div class="grid grid-cols-2 gap-2">
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Batch Files
                                  </label>
                                  <input
                                    type="number"
                                    name="batch_limit"
                                    value={String(t.batch_limit)}
                                    required
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent-500"
                                  />
                                </div>
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Priority Turbo
                                  </label>
                                  <select
                                    name="priority_queue"
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500"
                                  >
                                    <option value="0" selected={t.priority_queue === 0}>
                                      Standard
                                    </option>
                                    <option value="1" selected={t.priority_queue === 1}>
                                      Priority Turbo
                                    </option>
                                  </select>
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
                                  class="text-xs font-semibold text-neutral-300 cursor-pointer"
                                >
                                  Highlight as "Most Popular" card
                                </label>
                              </div>

                              {/* Feature lines */}
                              <div>
                                <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                  Features List (1 per line)
                                </label>
                                <textarea
                                  name="features"
                                  rows="5"
                                  class="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-accent-500"
                                >
                                  {featuresList.join("\n")}
                                </textarea>
                              </div>

                              {/* Button Text & Link */}
                              <div class="grid grid-cols-2 gap-2">
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Button Text
                                  </label>
                                  <input
                                    type="text"
                                    name="button_text"
                                    value={t.button_text}
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-500"
                                  />
                                </div>
                                <div>
                                  <label class="block text-xs font-semibold text-neutral-400 mb-1">
                                    Button Link
                                  </label>
                                  <input
                                    type="text"
                                    name="button_link"
                                    value={t.button_link}
                                    class="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-500"
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
                  <StoragePanel usage={storageUsage()} webroot={WEBROOT} />
                )}

                {currentTab === "conversions" && <ConversionsPanel snapshot={queueSnapshot()} />}

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
                    converters={converterVisibility()}
                  />
                )}
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
      return redirect(
        `${WEBROOT}/admin?tab=storage&msg=Cleanup+removed+${removed}+expired+job${removed === 1 ? "" : "s"}`,
        302,
      );
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
  // Which converters the site offers
  .post(
    "/features",
    async ({ body, jwt, redirect, cookie: { auth } }) => {
      if (!auth?.value) return redirect(`${WEBROOT}/login`, 302);
      const verified = (await jwt.verify(auth.value)) as { id: string } | false;
      if (!verified || !verified.id) return redirect(`${WEBROOT}/login`, 302);
      const adminUser = getUserById(verified.id);
      if (!adminUser || adminUser.role !== "admin") return redirect(`${WEBROOT}/`, 302);

      // An unticked box sends nothing, so the hidden list is everything not sent back
      const ticked = new Set(
        Array.isArray(body.visible) ? body.visible : body.visible ? [body.visible] : [],
      );
      const hidden = Object.keys(onlyAvailable(getAllTargets())).filter(
        (converter) => !ticked.has(converter),
      );
      setHiddenConverters(hidden);

      return redirect(
        `${WEBROOT}/admin?tab=site&msg=${encodeURIComponent(
          hidden.length === 0
            ? "Every converter is offered"
            : `${hidden.length} converter(s) hidden`,
        )}`,
        302,
      );
    },
    {
      body: t.Object({
        visible: t.Optional(t.Union([t.String(), t.Array(t.String())])),
      }),
      cookie: t.Cookie({ auth: t.Optional(t.String()) }),
    },
  );
