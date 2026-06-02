import { contextBridge, ipcRenderer } from 'electron';
import type { CarCareLogApi } from '../../shared/api';
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
} from '../../shared/types';

const api: CarCareLogApi = {
  getSnapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke('app:snapshot'),
  loadSampleData: (): Promise<AppSnapshot> => ipcRenderer.invoke('sample:load'),

  createVehicle: (input: VehicleInput): Promise<Vehicle> => ipcRenderer.invoke('vehicles:create', input),
  updateVehicle: (id: string, input: VehicleInput): Promise<Vehicle> => ipcRenderer.invoke('vehicles:update', id, input),
  deleteVehicle: (id: string): Promise<AppSnapshot> => ipcRenderer.invoke('vehicles:delete', id),

  createServiceRecord: (input: ServiceRecordInput): Promise<ServiceRecord> => ipcRenderer.invoke('services:create', input),
  updateServiceRecord: (id: string, input: ServiceRecordInput): Promise<ServiceRecord> =>
    ipcRenderer.invoke('services:update', id, input),
  deleteServiceRecord: (id: string): Promise<AppSnapshot> => ipcRenderer.invoke('services:delete', id),

  chooseAndAddAttachment: (request: AttachmentRequest): Promise<Attachment | null> =>
    ipcRenderer.invoke('attachments:choose-and-add', request),
  deleteAttachment: (id: string): Promise<AppSnapshot> => ipcRenderer.invoke('attachments:delete', id),
  getAttachmentPreview: (id: string): Promise<AttachmentPreview> => ipcRenderer.invoke('attachments:preview', id),
  runAttachmentOcr: (id: string): Promise<OcrReviewResult> => ipcRenderer.invoke('attachments:run-ocr', id),
  getAttachmentReview: (id: string): Promise<OcrReviewResult> => ipcRenderer.invoke('attachments:review', id),
  moveAttachmentToService: (attachmentId: string, serviceRecordId: string): Promise<Attachment> =>
    ipcRenderer.invoke('attachments:move-to-service', attachmentId, serviceRecordId),

  chooseDocumentForIntake: (request: DocumentIntakeRequest): Promise<DocumentIntakeResult | null> =>
    ipcRenderer.invoke('intake:choose-document', request),
  createServiceFromIntake: (request: CreateServiceFromIntakeRequest): Promise<ServiceRecord | null> =>
    ipcRenderer.invoke('intake:create-service', request),
  discardIntake: (intakeId: string): Promise<boolean> => ipcRenderer.invoke('intake:discard', intakeId),

  updateSettings: (settings: AppSettings): Promise<AppSettings> => ipcRenderer.invoke('settings:update', settings),
  exportCsv: (): Promise<ExportResult | null> => ipcRenderer.invoke('export:csv'),
  createBackup: (): Promise<BackupResult | null> => ipcRenderer.invoke('backup:create'),
  restoreBackup: (): Promise<RestoreResult | null> => ipcRenderer.invoke('backup:restore')
};

contextBridge.exposeInMainWorld('carCareLog', api);

export type { CarCareLogApi } from '../../shared/api';
