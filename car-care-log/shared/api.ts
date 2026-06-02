import type {
  AppSettings,
  AppSnapshot,
  Attachment,
  AttachmentPreview,
  AttachmentRequest,
  BackupResult,
  CreateServiceFromIntakeRequest,
  DocumentIntakeRequest,
  DocumentIntakeResult,
  ExportResult,
  OcrReviewResult,
  RestoreResult,
  ServiceRecord,
  ServiceRecordInput,
  Vehicle,
  VehicleInput
} from './types';

export interface CarCareLogApi {
  getSnapshot: () => Promise<AppSnapshot>;
  loadSampleData: () => Promise<AppSnapshot>;

  createVehicle: (input: VehicleInput) => Promise<Vehicle>;
  updateVehicle: (id: string, input: VehicleInput) => Promise<Vehicle>;
  deleteVehicle: (id: string) => Promise<AppSnapshot>;

  createServiceRecord: (input: ServiceRecordInput) => Promise<ServiceRecord>;
  updateServiceRecord: (id: string, input: ServiceRecordInput) => Promise<ServiceRecord>;
  deleteServiceRecord: (id: string) => Promise<AppSnapshot>;

  chooseAndAddAttachment: (request: AttachmentRequest) => Promise<Attachment | null>;
  deleteAttachment: (id: string) => Promise<AppSnapshot>;
  getAttachmentPreview: (id: string) => Promise<AttachmentPreview>;
  runAttachmentOcr: (id: string) => Promise<OcrReviewResult>;
  getAttachmentReview: (id: string) => Promise<OcrReviewResult>;
  moveAttachmentToService: (attachmentId: string, serviceRecordId: string) => Promise<Attachment>;

  chooseDocumentForIntake: (request: DocumentIntakeRequest) => Promise<DocumentIntakeResult | null>;
  createServiceFromIntake: (request: CreateServiceFromIntakeRequest) => Promise<ServiceRecord | null>;
  discardIntake: (intakeId: string) => Promise<boolean>;

  updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  exportCsv: () => Promise<ExportResult | null>;
  createBackup: () => Promise<BackupResult | null>;
  restoreBackup: () => Promise<RestoreResult | null>;
}
