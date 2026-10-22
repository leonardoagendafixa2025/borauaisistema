import { describe, it, expect } from "vitest";

describe("Operating Hours Logic (Overnight & Day keys)", () => {
  function isRestaurantOpen(
    currentTime: string,
    open: string,
    close: string,
    enabled: boolean = true
  ): boolean {
    if (!enabled) return false;
    if (close < open) {
      // Overnight (e.g., 18:00 to 02:00)
      return currentTime >= open || currentTime <= close;
    }
    // Standard (e.g., 11:00 to 23:00)
    return currentTime >= open && currentTime <= close;
  }

  it("handles standard opening hours correctly", () => {
    expect(isRestaurantOpen("12:00", "11:00", "23:00")).toBe(true);
    expect(isRestaurantOpen("10:59", "11:00", "23:00")).toBe(false);
    expect(isRestaurantOpen("23:01", "11:00", "23:00")).toBe(false);
  });

  it("handles overnight operating hours correctly (e.g. 18:00 to 02:00)", () => {
    // Prime evening dinner time (20:00) should be open
    expect(isRestaurantOpen("20:00", "18:00", "02:00")).toBe(true);
    // Midnight (00:30) should be open
    expect(isRestaurantOpen("00:30", "18:00", "02:00")).toBe(true);
    // Early morning before close (01:45) should be open
    expect(isRestaurantOpen("01:45", "18:00", "02:00")).toBe(true);
    // Afternoon (14:00) should be closed
    expect(isRestaurantOpen("14:00", "18:00", "02:00")).toBe(false);
    // Morning (06:00) should be closed
    expect(isRestaurantOpen("06:00", "18:00", "02:00")).toBe(false);
  });

  it("returns closed when enabled is false", () => {
    expect(isRestaurantOpen("20:00", "18:00", "02:00", false)).toBe(false);
  });
});

describe("Subscription Status Normalization Logic", () => {
  function evaluateSubscription(data: {
    status: string;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
  }) {
    const status = String(data.status || '').toLowerCase();
    const isTrial = status === 'trial' || status === 'trialing';
    
    const trialExpired = Boolean(
      isTrial && data.trial_ends_at && new Date(data.trial_ends_at).getTime() < Date.now()
    );
    
    const periodExpired = Boolean(
      !isTrial && data.current_period_end && (new Date(data.current_period_end).getTime() + 86400000) < Date.now()
    );

    const blockedStatuses = ['suspended', 'cancelled', 'canceled', 'overdue', 'past_due', 'unpaid', 'incomplete_expired'];
    const isBlocked = Boolean(trialExpired || periodExpired || blockedStatuses.includes(status));
    const isActive = !isBlocked && ['active', 'trial', 'trialing'].includes(status);

    return { isActive, isBlocked };
  }

  it("blocks Stripe 'canceled' (single 'l') and 'cancelled' (double 'l')", () => {
    expect(evaluateSubscription({ status: "canceled" }).isBlocked).toBe(true);
    expect(evaluateSubscription({ status: "canceled" }).isActive).toBe(false);
    expect(evaluateSubscription({ status: "cancelled" }).isBlocked).toBe(true);
  });

  it("blocks past_due, unpaid, and incomplete_expired subscriptions", () => {
    expect(evaluateSubscription({ status: "past_due" }).isBlocked).toBe(true);
    expect(evaluateSubscription({ status: "unpaid" }).isBlocked).toBe(true);
    expect(evaluateSubscription({ status: "incomplete_expired" }).isBlocked).toBe(true);
  });

  it("allows active subscriptions within current period", () => {
    const futureDate = new Date(Date.now() + 15 * 86400000).toISOString();
    const result = evaluateSubscription({ status: "active", current_period_end: futureDate });
    expect(result.isActive).toBe(true);
    expect(result.isBlocked).toBe(false);
  });

  it("blocks active subscriptions whose period has expired beyond 24h grace", () => {
    const expiredDate = new Date(Date.now() - 3 * 86400000).toISOString();
    const result = evaluateSubscription({ status: "active", current_period_end: expiredDate });
    expect(result.isActive).toBe(false);
    expect(result.isBlocked).toBe(true);
  });

  it("allows trialing subscriptions before trial_ends_at", () => {
    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString();
    const result = evaluateSubscription({ status: "trialing", trial_ends_at: futureDate });
    expect(result.isActive).toBe(true);
    expect(result.isBlocked).toBe(false);
  });
});
