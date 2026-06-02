import { categoriesAreRelated } from './serviceCategories';
import type { DuplicateRiskResult, ServiceRecord } from './types';

const MONTH_WINDOW = 24;

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(earlier: Date, later: Date): number {
  const years = later.getFullYear() - earlier.getFullYear();
  const months = later.getMonth() - earlier.getMonth();
  return years * 12 + months;
}

function byMostRecent(left: ServiceRecord, right: ServiceRecord): number {
  return right.serviceDate.localeCompare(left.serviceDate) || (right.mileage ?? 0) - (left.mileage ?? 0);
}

export interface DuplicateRiskInput {
  services: ServiceRecord[];
  vehicleId: string;
  category: string;
  serviceDate?: string;
  mileage?: number | null;
  mileageThreshold: number;
  excludeServiceId?: string;
}

export function findDuplicateRisk(input: DuplicateRiskInput): DuplicateRiskResult {
  const targetDate = parseDate(input.serviceDate ?? '') ?? new Date();
  const related = input.services
    .filter((service) => service.vehicleId === input.vehicleId)
    .filter((service) => service.id !== input.excludeServiceId)
    .filter((service) => categoriesAreRelated(service.category, input.category))
    .sort(byMostRecent);

  let reason: DuplicateRiskResult['reason'] = 'none';
  const risky = related.filter((service) => {
    const serviceDate = parseDate(service.serviceDate);
    const monthGap = serviceDate ? monthsBetween(serviceDate, targetDate) : Number.POSITIVE_INFINITY;
    const withinDateWindow = monthGap >= 0 && monthGap <= MONTH_WINDOW;
    const withinMileageWindow =
      typeof input.mileage === 'number' &&
      typeof service.mileage === 'number' &&
      Math.abs(input.mileage - service.mileage) <= input.mileageThreshold;

    if (withinDateWindow) reason = 'date_window';
    if (!withinDateWindow && withinMileageWindow) reason = 'mileage_window';
    return withinDateWindow || withinMileageWindow;
  });

  return {
    hasRisk: risky.length > 0,
    lastRecord: related[0] ?? null,
    relatedRecords: risky,
    reason: risky.length > 0 ? reason : 'none'
  };
}

export function findPriorRelatedService(
  services: ServiceRecord[],
  current: ServiceRecord,
  mileageThreshold: number
): DuplicateRiskResult {
  return findDuplicateRisk({
    services: services.filter((service) => {
      if (service.id === current.id) return false;
      if (service.vehicleId !== current.vehicleId) return false;
      if (!categoriesAreRelated(service.category, current.category)) return false;
      return service.serviceDate <= current.serviceDate;
    }),
    vehicleId: current.vehicleId,
    category: current.category,
    serviceDate: current.serviceDate,
    mileage: current.mileage,
    mileageThreshold,
    excludeServiceId: current.id
  });
}
