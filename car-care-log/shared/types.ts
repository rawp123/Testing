import type { AttachmentType, ServiceCategory } from './serviceCategories';

export type OcrStatus = 'not_run' | 'running' | 'extracted' | 'partial' | 'failed' | 'unavailable';
export type OcrConfidence = 'high' | 'medium' | 'low' | 'none';

export interface Vehicle {
  id: string;
  nickname: string;
  year: number | null;
  make: string;
  model: string;
  trim: string;
  vin: string;
  licensePlate: string;
  purchaseDate: string;
  startingMileage: number | null;
  currentMileage: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  serviceDate: string;
  mileage: number | null;
  shop: string;
  category: ServiceCategory;
  description: string;
  totalCost: number | null;
  notes: string;
  nextRecommendedDate: string;
  nextRecommendedMileage: number | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}

export type ServiceRecordInput = Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>;

export interface Attachment {
  id: string;
  serviceRecordId: string;
  label: string;
  type: AttachmentType;
  addedDate: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  ocrStatus: OcrStatus;
  ocrText: string;
  ocrError: string;
  ocrRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRequest {
  serviceRecordId: string;
  label: string;
  type: AttachmentType;
}

export interface AttachmentPreview {
  attachmentId: string;
  mimeType: string;
  dataUrl: string;
  previewKind: 'image' | 'pdf' | 'unsupported' | 'too_large';
}

export interface SuggestedField<T> {
  value: T;
  confidence: OcrConfidence;
  evidence: string;
}

export interface SuggestedServiceFields {
  serviceDate: SuggestedField<string>;
  mileage: SuggestedField<number | null>;
  shop: SuggestedField<string>;
  category: SuggestedField<ServiceCategory>;
  description: SuggestedField<string>;
  totalCost: SuggestedField<number | null>;
  notes: SuggestedField<string>;
  nextRecommendedDate: SuggestedField<string>;
  nextRecommendedMileage: SuggestedField<number | null>;
}

export interface OcrReviewResult {
  attachment: Attachment;
  suggested: SuggestedServiceFields;
  status: OcrStatus;
  text: string;
  error: string;
}

export interface DocumentIntakeRequest {
  vehicleId: string;
  label: string;
  type: AttachmentType;
}

export interface DocumentIntakeResult {
  intakeId: string;
  vehicleId: string;
  label: string;
  type: AttachmentType;
  addedDate: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  preview: AttachmentPreview;
  suggested: SuggestedServiceFields;
  status: OcrStatus;
  text: string;
  error: string;
}

export interface CreateServiceFromIntakeRequest {
  intakeId: string;
  service: ServiceRecordInput;
  attachmentLabel: string;
  attachmentType: AttachmentType;
}

export interface AppSettings {
  duplicateMileageThreshold: number;
}

export interface ExportResult {
  fileName: string;
  rowCount: number;
}

export interface BackupResult {
  backupName: string;
  vehicleCount: number;
  serviceCount: number;
  attachmentCount: number;
}

export interface RestoreResult {
  backupName: string;
  vehicleCount: number;
  serviceCount: number;
  attachmentCount: number;
}

export interface AppSnapshot {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  settings: AppSettings;
}

export interface DuplicateRiskResult {
  hasRisk: boolean;
  lastRecord: ServiceRecord | null;
  relatedRecords: ServiceRecord[];
  reason: 'date_window' | 'mileage_window' | 'none';
}
