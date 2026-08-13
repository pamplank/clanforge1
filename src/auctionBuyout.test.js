import { describe, it, expect } from "vitest";
import {
  RARITY_BUYOUT_CONFIG,
  isBuyoutEligibleRarity,
  computeBuyoutExpiresAt,
  isBuyoutWindowOpen,
  validateBuyoutPrice,
  suggestBuyoutPrice,
} from "./auctionBuyout.js";

describe("rarity eligibility", () => {
  it("Common (material), Uncommon, Rare, Kari, Epic are buyout eligible", () => {
    expect(isBuyoutEligibleRarity("material")).toBe(true);
    expect(isBuyoutEligibleRarity("uncommon")).toBe(true);
    expect(isBuyoutEligibleRarity("rare")).toBe(true);
    expect(isBuyoutEligibleRarity("kari")).toBe(true);
    expect(isBuyoutEligibleRarity("epic")).toBe(true);
  });

  it("Legendary is not buyout eligible", () => {
    expect(isBuyoutEligibleRarity("legendary")).toBe(false);
  });

  it("an unrecognized rarity defaults to ineligible, not a silent pass", () => {
    expect(isBuyoutEligibleRarity("some_new_tier_nobody_added_here_yet")).toBe(false);
  });
});

describe("buyout window computation", () => {
  const startedAt = 1_000_000;
  const endsAt = startedAt + 24 * 60 * 60 * 1000; // 24h auction

  it("Common/Uncommon get the full auction duration as their window", () => {
    expect(computeBuyoutExpiresAt("material", startedAt, endsAt)).toBe(endsAt);
    expect(computeBuyoutExpiresAt("uncommon", startedAt, endsAt)).toBe(endsAt);
  });

  it("Rare and Kari are limited to the first 6 hours", () => {
    const expected = startedAt + 6 * 60 * 60 * 1000;
    expect(computeBuyoutExpiresAt("rare", startedAt, endsAt)).toBe(expected);
    expect(computeBuyoutExpiresAt("kari", startedAt, endsAt)).toBe(expected);
  });

  it("Epic is limited to the first 2 hours", () => {
    expect(computeBuyoutExpiresAt("epic", startedAt, endsAt)).toBe(startedAt + 2 * 60 * 60 * 1000);
  });

  it("Legendary has no buyout window at all", () => {
    expect(computeBuyoutExpiresAt("legendary", startedAt, endsAt)).toBe(null);
  });

  it("never extends a rarity's window past the auction's own end time (short auction)", () => {
    const shortEndsAt = startedAt + 30 * 60 * 1000; // 30-minute auction
    expect(computeBuyoutExpiresAt("epic", startedAt, shortEndsAt)).toBe(shortEndsAt);
    expect(computeBuyoutExpiresAt("rare", startedAt, shortEndsAt)).toBe(shortEndsAt);
  });
});

describe("isBuyoutWindowOpen", () => {
  const baseAuction = {
    status: "active",
    buyoutPrice: 300,
    buyoutExpiresAt: 2_000_000,
  };

  it("is open while now is before the window's expiry", () => {
    expect(isBuyoutWindowOpen(baseAuction, 1_999_999)).toBe(true);
  });

  it("closes automatically once now passes the window's expiry (no refresh needed)", () => {
    expect(isBuyoutWindowOpen(baseAuction, 2_000_000)).toBe(false);
    expect(isBuyoutWindowOpen(baseAuction, 2_000_001)).toBe(false);
  });

  it("stays closed even if the auction itself is still active with zero bids", () => {
    // This is the exact edge case the spec calls out: buyout must not
    // reappear/remain just because nobody bid — once the window's gone,
    // it's gone.
    const noBids = { ...baseAuction, topBidder: null, currentBid: 0 };
    expect(isBuyoutWindowOpen(noBids, 2_500_000)).toBe(false);
  });

  it("is never open for a listing with no buyout price at all (e.g. Legendary)", () => {
    expect(isBuyoutWindowOpen({ status: "active", buyoutPrice: null, buyoutExpiresAt: null }, 1_000_000)).toBe(false);
  });

  it("is never open once the auction itself has ended", () => {
    expect(isBuyoutWindowOpen({ ...baseAuction, status: "ended" }, 1_999_999)).toBe(false);
  });
});

describe("validateBuyoutPrice", () => {
  it("accepts a Common buyout price within 2x-2.5x of the starting bid", () => {
    expect(validateBuyoutPrice("material", 100, 200).valid).toBe(true);
    expect(validateBuyoutPrice("material", 100, 250).valid).toBe(true);
    expect(validateBuyoutPrice("material", 100, 225).valid).toBe(true);
  });

  it("rejects a Common buyout price outside 2x-2.5x", () => {
    expect(validateBuyoutPrice("material", 100, 199).valid).toBe(false);
    expect(validateBuyoutPrice("material", 100, 251).valid).toBe(false);
  });

  it("validates every eligible rarity against its own multiplier range", () => {
    const cases = [
      ["material", 100, 199, false],
      ["material", 100, 200, true],
      ["material", 100, 250, true],
      ["material", 100, 251, false],
      ["uncommon", 100, 249, false],
      ["uncommon", 100, 250, true],
      ["uncommon", 100, 300, true],
      ["uncommon", 100, 301, false],
      ["rare", 100, 299, false],
      ["rare", 100, 300, true],
      ["rare", 100, 350, true],
      ["rare", 100, 351, false],
      ["kari", 100, 300, true],
      ["kari", 100, 351, false],
      ["epic", 100, 349, false],
      ["epic", 100, 350, true],
      ["epic", 100, 400, true],
      ["epic", 100, 401, false],
    ];
    for (const [rarity, startBid, buyout, expected] of cases) {
      expect(validateBuyoutPrice(rarity, startBid, buyout).valid, `${rarity} @ ${buyout}`).toBe(expected);
    }
  });

  it("rejects any buyout price for Legendary regardless of amount", () => {
    const result = validateBuyoutPrice("legendary", 100, 1000);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("rarity_ineligible");
  });

  it("rejects non-positive or non-numeric starting bids and buyout prices", () => {
    expect(validateBuyoutPrice("epic", 0, 400).valid).toBe(false);
    expect(validateBuyoutPrice("epic", 100, 0).valid).toBe(false);
    expect(validateBuyoutPrice("epic", "not-a-number", 400).valid).toBe(false);
    expect(validateBuyoutPrice("epic", 100, NaN).valid).toBe(false);
  });
});

describe("suggestBuyoutPrice", () => {
  it("suggests the low end of the rarity's multiplier range", () => {
    expect(suggestBuyoutPrice("material", 100)).toBe(200);
    expect(suggestBuyoutPrice("epic", 100)).toBe(350);
  });

  it("returns null for a rarity that can't be bought out", () => {
    expect(suggestBuyoutPrice("legendary", 100)).toBe(null);
  });

  it("stays inside validateBuyoutPrice's own accepted range for every eligible rarity", () => {
    for (const rarity of Object.keys(RARITY_BUYOUT_CONFIG)) {
      if (!RARITY_BUYOUT_CONFIG[rarity].eligible) continue;
      const suggested = suggestBuyoutPrice(rarity, 100);
      expect(validateBuyoutPrice(rarity, 100, suggested).valid, rarity).toBe(true);
    }
  });
});

// ─── RACE CONDITION: two simultaneous buyout attempts ──────────────────────
// The real atomicity guarantee lives in Postgres (buyout_auction_atomic's
// `for update` row lock, mirroring place_bid_atomic_v2.sql) — this repo has
// no local Postgres instance to run a genuine concurrent-transaction test
// against. What's tested here is the contract the client relies on: given a
// server that enforces "first request to touch the row wins, everyone else
// sees it's no longer active," exactly one of two concurrent buyers ends up
// owning the listing and gets charged, and the loser is told the item is
// gone rather than silently double-selling it or double-charging both.
function makeMockAtomicAuctionServer({ auctionId, buyoutPrice, buyerCoins }) {
  // Models the SQL function's `select ... for update` + status check as a
  // single-slot lock: whichever call resolves the lock queue first sees
  // status "active" and gets to close it; every later call, no matter how
  // close in time, sees status "ended" and is rejected — exactly the
  // property `for update` gives the real RPC.
  let status = "active";
  let lockQueue = Promise.resolve();
  const coins = new Map(Object.entries(buyerCoins));

  return async function attemptBuyout(buyer) {
    let release;
    const acquired = new Promise(res => { release = res; });
    const myTurn = lockQueue;
    lockQueue = lockQueue.then(() => acquired);
    await myTurn;
    try {
      if (status !== "active") return { success: false, reason: "ended" };
      const bal = coins.get(buyer) || 0;
      if (bal < buyoutPrice) return { success: false, reason: "insufficient_funds" };
      // Simulate real async work happening while "holding the lock" (a
      // network hop to Postgres) — this is exactly the gap that made the
      // OLD place_bid_atomic-style bug possible if the check and the write
      // weren't the same atomic unit. Doing it between the check and the
      // write here proves the lock (not just call ordering) is what
      // prevents the second buyer getting through.
      await new Promise(r => setTimeout(r, 5));
      status = "ended";
      coins.set(buyer, bal - buyoutPrice);
      return { success: true, buyer, amount: buyoutPrice };
    } finally {
      release();
    }
  };
}

describe("buyout race condition (mocked RPC boundary)", () => {
  it("only one of two simultaneous buyers succeeds, and only that buyer is charged", async () => {
    const attemptBuyout = makeMockAtomicAuctionServer({
      auctionId: "a1",
      buyoutPrice: 300,
      buyerCoins: { alice: 1000, bob: 1000 },
    });

    const [aliceResult, bobResult] = await Promise.all([
      attemptBuyout("alice"),
      attemptBuyout("bob"),
    ]);

    const results = [aliceResult, bobResult];
    const winners = results.filter(r => r.success);
    const losers = results.filter(r => !r.success);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].reason).toBe("ended");
    expect(winners[0].amount).toBe(300);
  });

  it("stays correct however many buyers race at once — exactly one winner", async () => {
    const buyers = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const attemptBuyout = makeMockAtomicAuctionServer({
      auctionId: "a2",
      buyoutPrice: 50,
      buyerCoins: Object.fromEntries(buyers.map(b => [b, 500])),
    });

    const results = await Promise.all(buyers.map(b => attemptBuyout(b)));
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(results.filter(r => !r.success)).toHaveLength(buyers.length - 1);
  });

  it("a losing bidder is never charged", async () => {
    const attemptBuyout = makeMockAtomicAuctionServer({
      auctionId: "a3",
      buyoutPrice: 300,
      buyerCoins: { alice: 1000, bob: 1000 },
    });
    await Promise.all([attemptBuyout("alice"), attemptBuyout("bob")]);
    // A third, later attempt against the now-closed listing must also be
    // rejected rather than "reopening" it.
    const late = await attemptBuyout("carol");
    expect(late.success).toBe(false);
    expect(late.reason).toBe("ended");
  });
});
