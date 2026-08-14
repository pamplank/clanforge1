import { describe, it, expect } from "vitest";
import {
  hasDistributableWinner,
  canManageDistribution,
  isPendingDistribution,
  filterPendingDistribution,
  buildDistributedPayload,
  buildUndistributedPayload,
  formatDistributedDate,
} from "./auctionDistribution.js";

const wonAuction = { id: "a1", status: "ended", topBidder: "Winner", distributed: false };

describe("hasDistributableWinner", () => {
  it("false for a still-active auction", () => {
    expect(hasDistributableWinner({ status: "active", topBidder: "Winner" })).toBe(false);
  });

  it("false for an ended auction with no winner", () => {
    expect(hasDistributableWinner({ status: "ended", topBidder: null })).toBe(false);
  });

  it("true for an ended auction with a winner", () => {
    expect(hasDistributableWinner(wonAuction)).toBe(true);
  });

  it("false for a missing auction", () => {
    expect(hasDistributableWinner(null)).toBe(false);
  });
});

describe("canManageDistribution — admin gating", () => {
  it("a non-admin can never manage distribution, even on a won auction", () => {
    expect(canManageDistribution(wonAuction, false)).toBe(false);
  });

  it("an admin can manage distribution on a won auction", () => {
    expect(canManageDistribution(wonAuction, true)).toBe(true);
  });

  it("an admin still can't manage distribution on an auction with no winner", () => {
    expect(canManageDistribution({ status: "ended", topBidder: null }, true)).toBe(false);
  });

  it("an admin still can't manage distribution on a still-active auction", () => {
    expect(canManageDistribution({ status: "active", topBidder: "Winner" }, true)).toBe(false);
  });

  it("gate applies identically to the undo direction (already-distributed auction)", () => {
    const distributed = { ...wonAuction, distributed: true, distributedBy: "Admin", distributedAt: "2026-08-14T00:00:00.000Z" };
    expect(canManageDistribution(distributed, true)).toBe(true);
    expect(canManageDistribution(distributed, false)).toBe(false);
  });
});

describe("isPendingDistribution / filterPendingDistribution", () => {
  it("a won, not-yet-distributed auction is pending", () => {
    expect(isPendingDistribution(wonAuction)).toBe(true);
  });

  it("a won auction already marked distributed is not pending", () => {
    expect(isPendingDistribution({ ...wonAuction, distributed: true })).toBe(false);
  });

  it("an ended auction with no winner is never pending (nothing to hand out)", () => {
    expect(isPendingDistribution({ status: "ended", topBidder: null, distributed: false })).toBe(false);
  });

  it("an active auction is never pending regardless of distributed flag", () => {
    expect(isPendingDistribution({ status: "active", topBidder: "Winner", distributed: false })).toBe(false);
  });

  it("filterPendingDistribution returns exactly the pending subset", () => {
    const auctions = [
      wonAuction, // pending
      { ...wonAuction, id: "a2", distributed: true }, // already distributed
      { id: "a3", status: "ended", topBidder: null, distributed: false }, // no winner
      { id: "a4", status: "active", topBidder: null, distributed: false }, // still active
      { id: "a5", status: "ended", topBidder: "Someone", distributed: false }, // pending
    ];
    expect(filterPendingDistribution(auctions).map(a => a.id)).toEqual(["a1", "a5"]);
  });

  it("filterPendingDistribution tolerates a missing/null list", () => {
    expect(filterPendingDistribution(null)).toEqual([]);
    expect(filterPendingDistribution(undefined)).toEqual([]);
  });
});

describe("buildDistributedPayload — mark as distributed", () => {
  it("sets distributed true and records the acting admin + timestamp", () => {
    const now = new Date("2026-08-14T18:30:00.000Z").getTime();
    const payload = buildDistributedPayload("a1", "AdminName", now);
    expect(payload).toEqual({
      id: "a1",
      distributed: true,
      distributed_at: "2026-08-14T18:30:00.000Z",
      distributed_by: "AdminName",
    });
  });

  it("is a partial row payload — only id + the three distribution columns", () => {
    const payload = buildDistributedPayload("a1", "AdminName", Date.now());
    expect(Object.keys(payload).sort()).toEqual(["distributed", "distributed_at", "distributed_by", "id"]);
  });
});

describe("buildUndistributedPayload — undo path", () => {
  it("clears the flag and both audit fields back to null", () => {
    expect(buildUndistributedPayload("a1")).toEqual({
      id: "a1",
      distributed: false,
      distributed_at: null,
      distributed_by: null,
    });
  });
});

describe("formatDistributedDate", () => {
  it('formats an ISO timestamp as "Aug 14, 2026"', () => {
    // Built from local wall-clock components (not a fixed UTC instant) so
    // this assertion holds no matter what timezone the test runs in — a
    // hardcoded UTC ISO string near a day boundary would format as a
    // different local date depending on the runner's offset.
    const localAug14Noon = new Date(2026, 7, 14, 12, 0, 0);
    expect(formatDistributedDate(localAug14Noon.toISOString())).toBe("Aug 14, 2026");
  });

  it("returns empty string for a null/missing timestamp", () => {
    expect(formatDistributedDate(null)).toBe("");
    expect(formatDistributedDate(undefined)).toBe("");
  });

  it("returns empty string for an unparseable timestamp rather than throwing", () => {
    expect(formatDistributedDate("not-a-date")).toBe("");
  });
});
