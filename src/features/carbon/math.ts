// Flight-emissions math — ported 1:1 from iOS CarbonFootprintView.swift
// (CarbonMath + TravelClass). ICAO-style model: distance × fuel-per-km ×
// class-of-service multiplier × passenger share.

export type TravelClass = 'economy' | 'premium' | 'business' | 'first';

export const TRAVEL_CLASSES: readonly TravelClass[] = ['economy', 'premium', 'business', 'first'];

/** ICAO class-of-service multiplier — premium cabins burn more fuel per seat. */
export const CLASS_MULTIPLIER: Record<TravelClass, number> = {
  economy: 1.0,
  premium: 1.5,
  business: 2.9,
  first: 4.0,
};

/** Great-circle under-reports routed distance (airways, holding) by ~5–10%. */
export const ROUTING_CORRECTION = 1.08;

/** Radiative-forcing uplift: physical CO₂ mass → warming-equivalent CO₂e. */
const RADIATIVE_FORCING = 1.9;

/** Fixed climb-out burn, kg CO₂ per passenger per leg. */
const CLIMB_CO2_KG = 105;
/** Cruise burn, kg CO₂ per passenger-km. */
const CRUISE_KG_PER_KM = 0.15;

/**
 * Physical CO₂ mass (kg) actually emitted — no radiative-forcing uplift.
 * Use for offset pricing, tree-years, and driving/electricity comparisons.
 * Formula (per leg): (climb burn + km × cruise factor) × class × passengers.
 */
export function co2MassKg(
  routedKmPerLeg: number,
  travelClass: TravelClass,
  passengers: number,
  legs: number,
): number {
  return (
    (CLIMB_CO2_KG + routedKmPerLeg * CRUISE_KG_PER_KM) *
    CLASS_MULTIPLIER[travelClass] *
    passengers *
    legs
  );
}

/** Warming-equivalent emissions (kg CO₂e) — headline figure only. */
export function co2eKg(
  routedKmPerLeg: number,
  travelClass: TravelClass,
  passengers: number,
  legs: number,
): number {
  return co2MassKg(routedKmPerLeg, travelClass, passengers, legs) * RADIATIVE_FORCING;
}

// Comparison + offset factors (iOS comparisonCard / offsetCard):
/** kg CO₂ a mature tree sequesters per year. */
export const TREE_KG_PER_YEAR = 21;
/** iOS: "driving co2Mass × 5 km" — an average car emits ~0.2 kg CO₂/km. */
export const DRIVING_KM_PER_KG = 5;
/** iOS: "co2Mass / 0.4 hours of typical US home electricity". */
export const HOME_ELECTRICITY_KG_PER_HOUR = 0.4;
/** Typical verified-offset price: $0.80 per 100 kg CO₂. */
export const OFFSET_USD_PER_100KG = 0.8;
