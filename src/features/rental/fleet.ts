// Deterministic demo rental fleet (the RN analog of the iOS RentalCarService
// demo vehicles — iOS also demos this flow when mock data is enabled). Rates
// are illustrative SAMPLE data; real availability lives on the provider sites.

import { parseDate } from '@/src/core/format';
import type { ISODate } from '@/src/types/models';

export type RentalProviderId = 'enterprise' | 'hertz' | 'national';

export interface RentalProviderMeta {
  id: RentalProviderId;
  name: string;
  letter: string;
  /** Brand accent used for pills/badges (kept legible on the dark theme). */
  color: string;
  url: string;
}

export const RENTAL_PROVIDERS: RentalProviderMeta[] = [
  { id: 'enterprise', name: 'Enterprise', letter: 'E', color: '#2FB673', url: 'https://www.enterprise.com/en/car-rental.html' },
  { id: 'hertz', name: 'Hertz', letter: 'H', color: '#FFD60A', url: 'https://www.hertz.com' },
  { id: 'national', name: 'National', letter: 'N', color: '#3B9EF0', url: 'https://www.nationalcar.com' },
];

export function providerMeta(id: RentalProviderId): RentalProviderMeta {
  return RENTAL_PROVIDERS.find((p) => p.id === id) ?? RENTAL_PROVIDERS[0];
}

export type VehicleClassId = 'economy' | 'suv' | 'luxury' | 'van';

export const VEHICLE_CLASSES: { id: VehicleClassId; label: string; icon: string }[] = [
  { id: 'economy', label: 'Economy', icon: 'car-outline' },
  { id: 'suv', label: 'SUV', icon: 'car' },
  { id: 'luxury', label: 'Luxury', icon: 'car-sport' },
  { id: 'van', label: 'Van', icon: 'bus' },
];

const CLASS_ORDER: Record<VehicleClassId, number> = { economy: 0, suv: 1, luxury: 2, van: 3 };

export function classMeta(id: VehicleClassId): { id: VehicleClassId; label: string; icon: string } {
  return VEHICLE_CLASSES.find((c) => c.id === id) ?? VEHICLE_CLASSES[0];
}

export interface RentalVehicle {
  id: string;
  provider: RentalProviderId;
  vehicleClass: VehicleClassId;
  make: string;
  model: string;
  seats: number;
  bags: number;
  automatic: boolean;
  /** Unlimited mileage (false = mileage caps/fees may apply). */
  unlimitedMileage: boolean;
  refundable: boolean;
  dailyRate: number; // USD
  features: string[];
}

/** ~12 vehicles across providers and classes. Deterministic — no randomness. */
export const DEMO_FLEET: RentalVehicle[] = [
  { id: 'ENT-COROLLA', provider: 'enterprise', vehicleClass: 'economy', make: 'Toyota', model: 'Corolla', seats: 5, bags: 2, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 42.99, features: ['Bluetooth', 'Backup camera', 'USB-C'] },
  { id: 'ENT-VERSA', provider: 'enterprise', vehicleClass: 'economy', make: 'Nissan', model: 'Versa', seats: 5, bags: 2, automatic: true, unlimitedMileage: true, refundable: false, dailyRate: 38.5, features: ['Bluetooth', 'Cruise control'] },
  { id: 'ENT-RAV4', provider: 'enterprise', vehicleClass: 'suv', make: 'Toyota', model: 'RAV4', seats: 5, bags: 3, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 67.0, features: ['AWD', 'Apple CarPlay', 'Backup camera'] },
  { id: 'ENT-PACIFICA', provider: 'enterprise', vehicleClass: 'van', make: 'Chrysler', model: 'Pacifica', seats: 7, bags: 4, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 88.0, features: ['3rd row seating', 'Sliding doors', 'Rear A/C'] },
  { id: 'HZ-RIO', provider: 'hertz', vehicleClass: 'economy', make: 'Kia', model: 'Rio', seats: 5, bags: 2, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 40.75, features: ['Bluetooth', 'USB'] },
  { id: 'HZ-EXPLORER', provider: 'hertz', vehicleClass: 'suv', make: 'Ford', model: 'Explorer', seats: 7, bags: 4, automatic: true, unlimitedMileage: false, refundable: false, dailyRate: 79.99, features: ['GPS', 'Apple CarPlay', 'Heated seats'] },
  { id: 'HZ-LEXUS-ES', provider: 'hertz', vehicleClass: 'luxury', make: 'Lexus', model: 'ES Hybrid', seats: 4, bags: 3, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 119.0, features: ['Hybrid', 'Apple CarPlay', 'Heated seats'] },
  { id: 'HZ-MB-CCLASS', provider: 'hertz', vehicleClass: 'luxury', make: 'Mercedes-Benz', model: 'C-Class', seats: 5, bags: 3, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 129.0, features: ['Leather', 'Navigation', 'Apple CarPlay'] },
  { id: 'NAT-ELANTRA', provider: 'national', vehicleClass: 'economy', make: 'Hyundai', model: 'Elantra', seats: 5, bags: 2, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 44.25, features: ['Bluetooth', 'Lane assist'] },
  { id: 'NAT-TAHOE', provider: 'national', vehicleClass: 'suv', make: 'Chevrolet', model: 'Tahoe', seats: 7, bags: 5, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 98.0, features: ['3rd row seating', '4WD', 'Tow package'] },
  { id: 'NAT-BMW5', provider: 'national', vehicleClass: 'luxury', make: 'BMW', model: '5 Series', seats: 5, bags: 3, automatic: true, unlimitedMileage: true, refundable: true, dailyRate: 129.99, features: ['GPS', 'Sunroof', 'Leather seats'] },
  { id: 'NAT-SIENNA', provider: 'national', vehicleClass: 'van', make: 'Toyota', model: 'Sienna', seats: 8, bags: 4, automatic: true, unlimitedMileage: false, refundable: false, dailyRate: 91.5, features: ['Hybrid', 'Sliding doors', 'Rear camera'] },
];

/** Rental days between two ISO dates (calendar-day diff, minimum 1). Pure. */
export function rentalDays(pickup: ISODate, dropoff: ISODate): number {
  const start = parseDate(pickup).getTime();
  const end = parseDate(dropoff).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export interface RentalQuote {
  base: number;
  taxes: number;
  total: number;
}

/** Deterministic quote: base = daily × days, taxes ≈ 15% (demo math). Pure. */
export function quoteFor(vehicle: RentalVehicle, days: number): RentalQuote {
  const base = Math.round(vehicle.dailyRate * days * 100) / 100;
  const taxes = Math.round(base * 0.15 * 100) / 100;
  return { base, taxes, total: Math.round((base + taxes) * 100) / 100 };
}

export type RentalSort = 'price' | 'class';

/** Filter + sort the fleet for the results list. Pure and deterministic. */
export function searchFleet(
  providers: RentalProviderId[],
  vehicleClass: VehicleClassId | null,
  sort: RentalSort,
): RentalVehicle[] {
  const rows = DEMO_FLEET.filter(
    (v) => providers.includes(v.provider) && (!vehicleClass || v.vehicleClass === vehicleClass),
  );
  return rows.sort((a, b) =>
    sort === 'price'
      ? a.dailyRate - b.dailyRate
      : CLASS_ORDER[a.vehicleClass] - CLASS_ORDER[b.vehicleClass] || a.dailyRate - b.dailyRate,
  );
}
