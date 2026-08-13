// ─── ITEM BUYOUT ────────────────────────────────────────────────────────────
// Pure logic for the "Buy Now" feature — kept out of App.jsx (which pulls in
// env vars, service worker registration, etc. at module scope) so it can be
// unit tested in isolation and so the rules live in exactly one place: the
// listing-creation validator (CreateAuctionPanel) and the live UI (
// AuctionGridCard/FeaturedAuctionSpotlight) both read from this same config,
// instead of two copies of the same multiplier table drifting apart.
//
// Rarity scoping approved by clan poll (rarity-limited + time-windowed
// buyout, no alternate "no window" configuration):
//   Common(material)/Uncommon — buyout available for the full auction
//   Rare/Kari                 — buyout only in the first 6 hours
//   Epic                      — buyout only in the first 2 hours
//   Legendary                 — no buyout at all
//
// `kari` isn't in the original spec's rarity table (it's this app's extra
// tier, ranked above epic — see RARITY_ORDER in App.jsx) — per clan
// direction it's scoped the same as Rare: 6h window, 3–3.5x multiplier.
export const RARITY_BUYOUT_CONFIG = {
  material:  { eligible: true,  windowMs: null,          minMult: 2,   maxMult: 2.5 },
  uncommon:  { eligible: true,  windowMs: null,          minMult: 2.5, maxMult: 3 },
  rare:      { eligible: true,  windowMs: 6*60*60*1000,  minMult: 3,   maxMult: 3.5 },
  kari:      { eligible: true,  windowMs: 6*60*60*1000,  minMult: 3,   maxMult: 3.5 },
  epic:      { eligible: true,  windowMs: 2*60*60*1000,  minMult: 3.5, maxMult: 4 },
  legendary: { eligible: false, windowMs: null,          minMult: null, maxMult: null },
};

// Unknown/missing rarity falls back to the strictest real tier (material's
// values would be wrong to assume) — legendary's "not eligible" is the safe
// default for anything this table doesn't recognize.
const FALLBACK_CONFIG = RARITY_BUYOUT_CONFIG.legendary;

export function getBuyoutConfig(rarity) {
  return RARITY_BUYOUT_CONFIG[rarity] || FALLBACK_CONFIG;
}

export function isBuyoutEligibleRarity(rarity) {
  return !!getBuyoutConfig(rarity).eligible;
}

// windowMs === null means "the whole auction duration" — the window closes
// exactly when the auction itself would, never later.
export function computeBuyoutExpiresAt(rarity, startedAt, endsAt) {
  const cfg = getBuyoutConfig(rarity);
  if (!cfg.eligible) return null;
  if (cfg.windowMs == null) return endsAt;
  return Math.min(startedAt + cfg.windowMs, endsAt);
}

// Buyout is unavailable once the window has closed even with zero bids —
// this is deliberate (see spec): it avoids buyout ever undercutting a bid
// placed right at the window boundary, so there's no "grace" re-check here.
export function isBuyoutWindowOpen(auction, now = Date.now()) {
  if (!auction) return false;
  if (auction.status !== "active") return false;
  if (auction.buyoutPrice == null) return false;
  if (auction.buyoutExpiresAt == null) return false;
  return now < auction.buyoutExpiresAt;
}

const EPSILON = 1e-9;

// Validates a seller-chosen buyout price against the rarity's multiplier-
// of-starting-bid range. Used both at listing creation (block submission on
// an out-of-range price) and defensively wherever a buyout price is read
// back from the database.
export function validateBuyoutPrice(rarity, startingBid, buyoutPrice) {
  const cfg = getBuyoutConfig(rarity);
  if (!cfg.eligible) return { valid: false, reason: "rarity_ineligible" };

  const sb = Number(startingBid);
  const bp = Number(buyoutPrice);
  if (!Number.isFinite(sb) || sb <= 0) return { valid: false, reason: "invalid_starting_bid" };
  if (!Number.isFinite(bp) || bp <= 0) return { valid: false, reason: "invalid_buyout_price" };

  const min = sb * cfg.minMult;
  const max = sb * cfg.maxMult;
  if (bp < min - EPSILON || bp > max + EPSILON) {
    return { valid: false, reason: "out_of_range", min, max };
  }
  return { valid: true, min, max };
}

// Suggested default a listing-creation form can pre-fill — the low end of
// the allowed range, rounded to a whole coin.
export function suggestBuyoutPrice(rarity, startingBid) {
  const cfg = getBuyoutConfig(rarity);
  if (!cfg.eligible) return null;
  const sb = Number(startingBid);
  if (!Number.isFinite(sb) || sb <= 0) return null;
  return Math.round(sb * cfg.minMult);
}
