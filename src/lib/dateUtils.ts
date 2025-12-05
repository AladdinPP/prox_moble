// src/lib/dateUtils.ts

/**
 * Returns a date string in the format YYYY-MM-DD representing
 * how far back we want to look when querying for deal data.
 *
 * Right now we just use "7 days ago" as a simple default.
 */
export function getLatestRefreshDate(daysBack: number = 7): string {
  const now = new Date();

  // Move the date backwards by `daysBack` days
  now.setDate(now.getDate() - daysBack);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  // This returns something like "2025-12-04"
  return `${year}-${month}-${day}`;
}

/**
 * Formats a distance value in meters into a human-friendly string.
 *
 * Examples:
 *   formatDistance(1609.34)  -> "1.0 mi"
 *   formatDistance(500)      -> "164 ft"
 *   formatDistance(30000)    -> "19 mi"
 */
export function formatDistance(
  distanceMeters: number | null | undefined
): string {
  if (distanceMeters == null || isNaN(distanceMeters)) {
    return "";
  }

  const miles = distanceMeters / 1609.34;

  // Very close: show feet
  if (miles < 0.1) {
    const feet = distanceMeters * 3.28084;
    return `${feet.toFixed(0)} ft`;
  }

  // Normal distances: one decimal place
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  // Longer distances: whole miles
  return `${Math.round(miles)} mi`;
}
