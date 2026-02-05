import { describe, it, expect } from "vitest";
import { haversine, estimateTravelTime } from "../haversine";

describe("haversine", () => {
  it("returns 0 for same coordinates", () => {
    expect(haversine(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates distance between New York and Los Angeles (~2450 miles)", () => {
    // NYC: 40.7128° N, 74.0060° W
    // LA: 34.0522° N, 118.2437° W
    const distance = haversine(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(2400);
    expect(distance).toBeLessThan(2500);
  });

  it("calculates distance between Boston and Philadelphia (~270 miles)", () => {
    // Boston: 42.3601° N, 71.0589° W
    // Philadelphia: 39.9526° N, 75.1652° W
    const distance = haversine(42.3601, -71.0589, 39.9526, -75.1652);
    expect(distance).toBeGreaterThan(260);
    expect(distance).toBeLessThan(290);
  });

  it("is symmetric (distance A to B equals B to A)", () => {
    const distanceAB = haversine(40.7128, -74.006, 34.0522, -118.2437);
    const distanceBA = haversine(34.0522, -118.2437, 40.7128, -74.006);
    expect(distanceAB).toBeCloseTo(distanceBA, 10);
  });

  it("handles crossing the prime meridian", () => {
    // London: 51.5074° N, 0.1278° W
    // Paris: 48.8566° N, 2.3522° E
    const distance = haversine(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(250);
  });

  it("handles southern hemisphere coordinates", () => {
    // Sydney: 33.8688° S, 151.2093° E
    // Melbourne: 37.8136° S, 144.9631° E
    const distance = haversine(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(500);
  });
});

describe("estimateTravelTime", () => {
  describe("drive mode", () => {
    it("calculates time at 55 mph average", () => {
      expect(estimateTravelTime(110, "drive")).toBeCloseTo(2, 1);
    });

    it("returns 0 for 0 miles", () => {
      expect(estimateTravelTime(0, "drive")).toBe(0);
    });

    it("calculates correctly for long distances", () => {
      // 550 miles at 55 mph = 10 hours
      expect(estimateTravelTime(550, "drive")).toBeCloseTo(10, 1);
    });
  });

  describe("fly mode", () => {
    it("adds 2.5 hour overhead plus flight time at 500 mph", () => {
      // 500 miles = 2.5 + 1 = 3.5 hours
      expect(estimateTravelTime(500, "fly")).toBeCloseTo(3.5, 1);
    });

    it("returns 2.5 hours minimum for 0 miles (airport overhead)", () => {
      expect(estimateTravelTime(0, "fly")).toBe(2.5);
    });

    it("calculates correctly for cross-country flights", () => {
      // 2500 miles = 2.5 + 5 = 7.5 hours
      expect(estimateTravelTime(2500, "fly")).toBeCloseTo(7.5, 1);
    });
  });

  describe("mixed mode", () => {
    it("uses drive time for distances <= 500 miles", () => {
      const driveTime = estimateTravelTime(300, "drive");
      const mixedTime = estimateTravelTime(300, "mixed");
      expect(mixedTime).toBe(driveTime);
    });

    it("uses fly time for distances > 500 miles", () => {
      const flyTime = estimateTravelTime(600, "fly");
      const mixedTime = estimateTravelTime(600, "mixed");
      expect(mixedTime).toBe(flyTime);
    });

    it("uses drive at exactly 500 miles", () => {
      const driveTime = estimateTravelTime(500, "drive");
      const mixedTime = estimateTravelTime(500, "mixed");
      expect(mixedTime).toBe(driveTime);
    });

    it("uses fly at 501 miles", () => {
      const flyTime = estimateTravelTime(501, "fly");
      const mixedTime = estimateTravelTime(501, "mixed");
      expect(mixedTime).toBe(flyTime);
    });
  });
});
