import type { ServiceRecord, Vehicle } from './types';

const HEADERS = [
  'Vehicle',
  'Year',
  'Make',
  'Model',
  'VIN',
  'License plate',
  'Service date',
  'Mileage',
  'Category',
  'Description',
  'Shop/provider',
  'Total cost',
  'Next recommended date',
  'Next recommended mileage',
  'Notes',
  'Attachment labels',
  'OCR status'
];

function escapeCsv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildServicesCsv(vehicles: Vehicle[], services: ServiceRecord[]): string {
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const rows = services.map((service) => {
    const vehicle = vehiclesById.get(service.vehicleId);
    return [
      vehicle?.nickname ?? '',
      vehicle?.year ?? '',
      vehicle?.make ?? '',
      vehicle?.model ?? '',
      vehicle?.vin ?? '',
      vehicle?.licensePlate ?? '',
      service.serviceDate,
      service.mileage ?? '',
      service.category,
      service.description,
      service.shop,
      service.totalCost ?? '',
      service.nextRecommendedDate,
      service.nextRecommendedMileage ?? '',
      service.notes,
      service.attachments.map((attachment) => attachment.label).join('; '),
      service.attachments.map((attachment) => attachment.ocrStatus).join('; ')
    ].map(escapeCsv);
  });

  return [HEADERS.map(escapeCsv), ...rows].map((row) => row.join(',')).join('\n');
}
