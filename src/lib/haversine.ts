const R = 3958.8; // Earth radius in miles

export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateTravelTime(
  distanceMiles: number,
  mode: "drive" | "fly" | "mixed"
): number {
  if (mode === "fly") {
    return 2.5 + distanceMiles / 500; // hours: 2.5hr airport overhead + flight
  }
  if (mode === "drive") {
    return distanceMiles / 55; // average 55 mph
  }
  // mixed: fly if > 500 miles, drive otherwise
  return distanceMiles > 500
    ? 2.5 + distanceMiles / 500
    : distanceMiles / 55;
}
