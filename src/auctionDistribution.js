// ─── DISTRIBUTION TRACKING ──────────────────────────────────────────────────
// Pure logic for the "Mark as Distributed" Auction History quality-of-life
// feature — kept out of App.jsx (same reasoning as auctionBuyout.js: no env
// vars or DOM/service-worker code at module scope, so this can be unit
// tested in isolation and the rules live in exactly one place).
//
// Problem this closes: after an auction ends, an admin hands the won item to
// the winner OUTSIDE the app (Discord, in-game trade, etc.) — there was no
// way to track whether that handoff had actually happened, so admins could
// lose track of which won items still owed to a winner. `distributed` +
// `distributedAt`/`distributedBy` on the auctions row is the tracking; these
// helpers are the rules for who can flip it and what the write looks like.
//
// Server-side enforcement note: this app has no per-request admin identity
// (anon Supabase key shared by every client, custom username/password login
// — see verifyLogin/App.jsx). Every other admin-gated action in the app
// (coin adjustments, attendance, removing auctions, etc.) is gated the same
// way: client-side role check only, no RPC-side role re-verification. This
// feature intentionally matches that existing pattern rather than
// introducing a one-off stronger check for just this mutation.

// True once an auction is eligible to have its distribution status shown or
// toggled at all: it has to have actually ended with a winner — there's
// nothing to hand out on a still-active listing or one nobody bid on.
export function hasDistributableWinner(auction) {
  return !!auction && auction.status === "ended" && !!auction.topBidder;
}

// Gates the "Mark as Distributed" button / the undo click on the badge.
// Same admin check used everywhere else in the app (role === "Elder" ||
// "Master") — see isAdmin in Auctions(). Works in both directions (marking
// and un-marking use the same gate).
export function canManageDistribution(auction, isAdmin) {
  return !!isAdmin && hasDistributableWinner(auction);
}

// A won auction is "pending distribution" until an admin marks it — this is
// the definition the History filter and any at-a-glance badge logic should
// share, so they can never disagree about which rows count.
export function isPendingDistribution(auction) {
  return hasDistributableWinner(auction) && !auction?.distributed;
}

export function filterPendingDistribution(auctions) {
  return (auctions || []).filter(isPendingDistribution);
}

// Partial-row payload for marking an auction distributed. Deliberately only
// the columns that change (id + the three distribution columns) — this gets
// sent through a PostgREST upsert with resolution=merge-duplicates, which
// only SETs the columns present in the payload on conflict, so it can never
// clobber a concurrently-changing field (bids, current_bid, etc.) with this
// browser's stale local copy the way a full-row upsert could.
export function buildDistributedPayload(auctionId, adminName, now = Date.now()) {
  return {
    id: auctionId,
    distributed: true,
    distributed_at: new Date(now).toISOString(),
    distributed_by: adminName,
  };
}

// Undo path — clears the audit fields rather than just flipping the flag
// back, so a re-mark always records a fresh admin/timestamp instead of
// showing stale data from the reverted mark.
export function buildUndistributedPayload(auctionId) {
  return {
    id: auctionId,
    distributed: false,
    distributed_at: null,
    distributed_by: null,
  };
}

// "Aug 14, 2026" — matches the format used in the "Distributed by X on Y"
// badge subtext/tooltip. Returns "" for a missing/unparseable timestamp so
// callers can decide whether to show the "by <name>" half on its own.
export function formatDistributedDate(distributedAtIso) {
  if (!distributedAtIso) return "";
  const d = new Date(distributedAtIso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
