export const SERVICE_CATEGORIES = [
  'Oil change',
  'Tire rotation',
  'Tires',
  'Brakes',
  'Battery',
  'Coolant',
  'Transmission',
  'Brake fluid',
  'Filters',
  'Inspection/emissions',
  'Alignment',
  'Wipers',
  'Other'
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const COMMON_SERVICE_CATEGORIES: ServiceCategory[] = [
  'Oil change',
  'Tire rotation',
  'Brakes',
  'Battery',
  'Coolant',
  'Transmission',
  'Brake fluid',
  'Filters',
  'Inspection/emissions'
];

export const ATTACHMENT_TYPES = [
  'receipt',
  'invoice',
  'estimate',
  'inspection report',
  'warranty document',
  'photo',
  'other'
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

const CATEGORY_GROUPS: Record<ServiceCategory, string> = {
  'Oil change': 'oil',
  'Tire rotation': 'tires',
  Tires: 'tires',
  Brakes: 'brakes',
  Battery: 'battery',
  Coolant: 'coolant',
  Transmission: 'transmission',
  'Brake fluid': 'brakes',
  Filters: 'filters',
  'Inspection/emissions': 'inspection',
  Alignment: 'tires',
  Wipers: 'wipers',
  Other: 'other'
};

export function normalizeCategory(category: string): string {
  const match = SERVICE_CATEGORIES.find((item) => item.toLowerCase() === category.toLowerCase());
  return match ? CATEGORY_GROUPS[match] : category.trim().toLowerCase();
}

export function categoriesAreRelated(left: string, right: string): boolean {
  return normalizeCategory(left) === normalizeCategory(right);
}
