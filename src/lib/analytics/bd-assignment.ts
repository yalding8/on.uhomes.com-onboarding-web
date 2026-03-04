/**
 * S4.2: BD Auto-Assignment Engine
 *
 * Territory-based routing with 4-tier fallback:
 *   1. Referral code → assigned BD
 *   2. City match → city-specific BD
 *   3. Country match → lowest-load BD in that country
 *   4. Global fallback → lowest-load BD overall
 *
 * Skips inactive (is_active=false) and paused (priority=-1) BDs.
 */

export interface BDTerritory {
  bd_user_id: string;
  country_code: string | null;
  city: string | null;
  active_count: number;
  is_active: boolean;
  priority: number; // 0=normal, 1=priority, -1=paused
  referral_code: string | null;
}

export interface ApplicationInput {
  referral_code: string | null;
  city: string;
  country_code: string;
}

export interface AssignmentResult {
  bd_user_id: string;
  reason: "referral" | "city" | "country" | "global";
}

function isActiveBD(territory: BDTerritory): boolean {
  return territory.is_active && territory.priority >= 0;
}

function lowestLoad(territories: BDTerritory[]): BDTerritory | undefined {
  return territories
    .filter(isActiveBD)
    .sort((a, b) => a.active_count - b.active_count)[0];
}

export function assignBD(
  input: ApplicationInput,
  territories: BDTerritory[],
): AssignmentResult | null {
  const active = territories.filter(isActiveBD);
  if (active.length === 0) return null;

  // 1. Referral code match
  if (input.referral_code) {
    const refCode = input.referral_code.toUpperCase();
    const match = active.find(
      (t) => t.referral_code?.toUpperCase() === refCode,
    );
    if (match) return { bd_user_id: match.bd_user_id, reason: "referral" };
  }

  // 2. City match
  const cityNorm = input.city.toLowerCase();
  const cityMatch = active.find((t) => t.city?.toLowerCase() === cityNorm);
  if (cityMatch) return { bd_user_id: cityMatch.bd_user_id, reason: "city" };

  // 3. Country fallback (lowest load among country BDs without city restriction)
  const countryNorm = input.country_code.toUpperCase();
  const countryBDs = active.filter(
    (t) => t.country_code?.toUpperCase() === countryNorm && !t.city,
  );
  const countryPick = lowestLoad(countryBDs);
  if (countryPick) {
    return { bd_user_id: countryPick.bd_user_id, reason: "country" };
  }

  // 4. Global fallback (BDs with no country/city restriction)
  const globalBDs = active.filter((t) => !t.country_code && !t.city);
  const globalPick = lowestLoad(globalBDs);
  if (globalPick) {
    return { bd_user_id: globalPick.bd_user_id, reason: "global" };
  }

  return null;
}
