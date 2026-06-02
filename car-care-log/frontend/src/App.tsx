import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ArchiveRestore,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileArchive,
  FileSearch,
  FileText,
  FolderOpen,
  Gauge,
  History,
  Image,
  Info,
  LayoutDashboard,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X
} from 'lucide-react';
import {
  ATTACHMENT_TYPES,
  COMMON_SERVICE_CATEGORIES,
  SERVICE_CATEGORIES,
  type AttachmentType
} from '../../shared/serviceCategories';
import { findDuplicateRisk, findPriorRelatedService } from '../../shared/duplicateRisk';
import { userSafeErrorMessage } from '../../shared/safeErrors';
import type {
  AppSettings,
  AppSnapshot,
  Attachment,
  AttachmentPreview,
  DocumentIntakeResult,
  DuplicateRiskResult,
  OcrConfidence,
  OcrReviewResult,
  ServiceRecord,
  ServiceRecordInput,
  SuggestedField,
  SuggestedServiceFields,
  Vehicle,
  VehicleInput
} from '../../shared/types';

type ViewKey = 'dashboard' | 'vehicles' | 'services' | 'documents' | 'export' | 'settings';
type Status = { tone: 'success' | 'error' | 'info'; message: string } | null;

interface VehicleFormState {
  nickname: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  licensePlate: string;
  purchaseDate: string;
  startingMileage: string;
  currentMileage: string;
  notes: string;
}

interface ServiceFormState {
  vehicleId: string;
  serviceDate: string;
  mileage: string;
  shop: string;
  category: string;
  description: string;
  totalCost: string;
  notes: string;
  nextRecommendedDate: string;
  nextRecommendedMileage: string;
}

interface AttachmentFormState {
  serviceRecordId: string;
  label: string;
  type: AttachmentType;
}

type DocumentReviewState =
  | {
      source: 'attachment';
      review: OcrReviewResult;
      preview: AttachmentPreview | null;
      draft: ServiceFormState;
    }
  | {
      source: 'intake';
      intake: DocumentIntakeResult;
      draft: ServiceFormState;
    };

const navItems: Array<{ key: ViewKey; label: string; icon: ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'vehicles', label: 'Vehicles', icon: <Car size={18} /> },
  { key: 'services', label: 'Service Log', icon: <ClipboardList size={18} /> },
  { key: 'documents', label: 'Documents', icon: <FileText size={18} /> },
  { key: 'export', label: 'Export / Backup', icon: <FileArchive size={18} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={18} /> }
];

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyVehicleForm(): VehicleFormState {
  return {
    nickname: '',
    year: '',
    make: '',
    model: '',
    trim: '',
    vin: '',
    licensePlate: '',
    purchaseDate: '',
    startingMileage: '',
    currentMileage: '',
    notes: ''
  };
}

function emptyServiceForm(vehicleId = ''): ServiceFormState {
  return {
    vehicleId,
    serviceDate: todayInput(),
    mileage: '',
    shop: '',
    category: 'Oil change',
    description: '',
    totalCost: '',
    notes: '',
    nextRecommendedDate: '',
    nextRecommendedMileage: ''
  };
}

function vehicleToForm(vehicle: Vehicle): VehicleFormState {
  return {
    nickname: vehicle.nickname,
    year: vehicle.year?.toString() ?? '',
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    vin: vehicle.vin,
    licensePlate: vehicle.licensePlate,
    purchaseDate: vehicle.purchaseDate,
    startingMileage: vehicle.startingMileage?.toString() ?? '',
    currentMileage: vehicle.currentMileage?.toString() ?? '',
    notes: vehicle.notes
  };
}

function serviceToForm(service: ServiceRecord): ServiceFormState {
  return {
    vehicleId: service.vehicleId,
    serviceDate: service.serviceDate,
    mileage: service.mileage?.toString() ?? '',
    shop: service.shop,
    category: service.category,
    description: service.description,
    totalCost: service.totalCost?.toString() ?? '',
    notes: service.notes,
    nextRecommendedDate: service.nextRecommendedDate,
    nextRecommendedMileage: service.nextRecommendedMileage?.toString() ?? ''
  };
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function vehiclePayload(form: VehicleFormState): VehicleInput {
  return {
    nickname: form.nickname,
    year: numberOrNull(form.year),
    make: form.make,
    model: form.model,
    trim: form.trim,
    vin: form.vin,
    licensePlate: form.licensePlate,
    purchaseDate: form.purchaseDate,
    startingMileage: numberOrNull(form.startingMileage),
    currentMileage: numberOrNull(form.currentMileage),
    notes: form.notes
  };
}

function servicePayload(form: ServiceFormState): ServiceRecordInput {
  return {
    vehicleId: form.vehicleId,
    serviceDate: form.serviceDate,
    mileage: numberOrNull(form.mileage),
    shop: form.shop,
    category: SERVICE_CATEGORIES.includes(form.category as (typeof SERVICE_CATEGORIES)[number])
      ? (form.category as ServiceRecordInput['category'])
      : 'Other',
    description: form.description,
    totalCost: numberOrNull(form.totalCost),
    notes: form.notes,
    nextRecommendedDate: form.nextRecommendedDate,
    nextRecommendedMileage: numberOrNull(form.nextRecommendedMileage)
  };
}

function suggestedToServiceForm(suggested: SuggestedServiceFields, vehicleId: string): ServiceFormState {
  return {
    vehicleId,
    serviceDate: suggested.serviceDate.value || todayInput(),
    mileage: suggested.mileage.value?.toString() ?? '',
    shop: suggested.shop.value,
    category: suggested.category.value,
    description: suggested.description.value,
    totalCost: suggested.totalCost.value?.toString() ?? '',
    notes: suggested.notes.value,
    nextRecommendedDate: suggested.nextRecommendedDate.value,
    nextRecommendedMileage: suggested.nextRecommendedMileage.value?.toString() ?? ''
  };
}

function usefulSuggestedValue<T>(suggested: SuggestedField<T>, isEmpty: (value: T) => boolean): boolean {
  return suggested.confidence !== 'none' && !isEmpty(suggested.value);
}

function mergeSuggestionsIntoExistingService(base: ServiceFormState, suggested: SuggestedServiceFields): ServiceFormState {
  const next = { ...base };
  if (!next.serviceDate && usefulSuggestedValue(suggested.serviceDate, (value) => value.trim() === '')) {
    next.serviceDate = suggested.serviceDate.value;
  }
  if (!next.mileage && usefulSuggestedValue(suggested.mileage, (value) => value === null)) {
    next.mileage = suggested.mileage.value?.toString() ?? '';
  }
  if (!next.shop && usefulSuggestedValue(suggested.shop, (value) => value.trim() === '')) {
    next.shop = suggested.shop.value;
  }
  if ((next.category === 'Other' || !next.category) && suggested.category.value !== 'Other' && suggested.category.confidence !== 'none') {
    next.category = suggested.category.value;
  }
  if (!next.description && usefulSuggestedValue(suggested.description, (value) => value.trim() === '')) {
    next.description = suggested.description.value;
  }
  if (!next.totalCost && usefulSuggestedValue(suggested.totalCost, (value) => value === null)) {
    next.totalCost = suggested.totalCost.value?.toString() ?? '';
  }
  if (!next.notes && usefulSuggestedValue(suggested.notes, (value) => value.trim() === '')) {
    next.notes = suggested.notes.value;
  }
  if (!next.nextRecommendedDate && usefulSuggestedValue(suggested.nextRecommendedDate, (value) => value.trim() === '')) {
    next.nextRecommendedDate = suggested.nextRecommendedDate.value;
  }
  if (!next.nextRecommendedMileage && usefulSuggestedValue(suggested.nextRecommendedMileage, (value) => value === null)) {
    next.nextRecommendedMileage = suggested.nextRecommendedMileage.value?.toString() ?? '';
  }
  return next;
}

function formatDate(value: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDateTime(value: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatMileage(value: number | null): string {
  return typeof value === 'number' ? `${value.toLocaleString()} mi` : 'Mileage not recorded';
}

function formatMoney(value: number | null): string {
  if (typeof value !== 'number') return 'Cost not recorded';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function vehicleName(vehicle: Vehicle | undefined): string {
  if (!vehicle) return 'Unknown vehicle';
  const details = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return details ? `${vehicle.nickname} · ${details}` : vehicle.nickname;
}

function totalSpend(services: ServiceRecord[]): number {
  return services.reduce((sum, service) => sum + (service.totalCost ?? 0), 0);
}

function searchableText(service: ServiceRecord, vehicle?: Vehicle): string {
  return [
    vehicle?.nickname,
    vehicle?.make,
    vehicle?.model,
    service.category,
    service.description,
    service.shop,
    service.notes,
    ...service.attachments.map((attachment) => `${attachment.label} ${attachment.ocrText}`)
  ]
    .join(' ')
    .toLowerCase();
}

function serviceMatchesQuery(service: ServiceRecord, vehicle: Vehicle | undefined, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return searchableText(service, vehicle).includes(normalized);
}

function lastServicesByCategory(services: ServiceRecord[]): Array<{ category: string; service: ServiceRecord | null }> {
  return COMMON_SERVICE_CATEGORIES.map((category) => ({
    category,
    service:
      services
        .filter((service) => service.category === category)
        .sort((left, right) => right.serviceDate.localeCompare(left.serviceDate))[0] ?? null
  }));
}

function duplicateRiskTitle(risk: DuplicateRiskResult, currentCategory: string): string {
  if (!risk.lastRecord) return 'Possible related record';
  return risk.lastRecord.category === currentCategory
    ? `Last recorded ${risk.lastRecord.category.toLowerCase()} service`
    : `Possible related ${risk.lastRecord.category.toLowerCase()} record`;
}

function duplicateRiskReason(risk: DuplicateRiskResult, mileageThreshold: number): string {
  if (risk.reason === 'date_window') return 'within the 24-month review window';
  if (risk.reason === 'mileage_window') return `within ${mileageThreshold.toLocaleString()} miles`;
  return 'based on your records';
}

function duplicateRiskCopy(risk: DuplicateRiskResult, currentCategory: string, mileageThreshold: number): string {
  if (!risk.lastRecord) return '';
  const record = risk.lastRecord;
  const context = risk.hasRisk
    ? ` This may have been done recently ${duplicateRiskReason(risk, mileageThreshold)}.`
    : '';
  const relatedCopy = record.category === currentCategory ? '' : ` (${record.category})`;
  return `${formatDate(record.serviceDate)} at ${formatMileage(record.mileage)}${relatedCopy}.${context} Review your records before approving repeat maintenance.`;
}

function App(): JSX.Element {
  const browserPreview = Boolean(window.__CAR_CARE_LOG_BROWSER_PREVIEW__);
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await window.carCareLog.getSnapshot();
    setSnapshot(next);
    setSelectedVehicleId((current) => current || next.vehicles[0]?.id || '');
  }, []);

  useEffect(() => {
    refresh()
      .catch((error) => setStatus({ tone: 'error', message: userSafeErrorMessage(error) }))
      .finally(() => setLoading(false));
  }, [refresh]);

  const vehicles = snapshot?.vehicles ?? [];
  const services = snapshot?.services ?? [];
  const settings = snapshot?.settings ?? { duplicateMileageThreshold: 15000 };
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const firstRun = !loading && vehicles.length === 0 && services.length === 0;

  async function loadSamples(): Promise<void> {
    const next = await window.carCareLog.loadSampleData();
    setSnapshot(next);
    setSelectedVehicleId(next.vehicles[0]?.id ?? '');
    setStatus({ tone: 'success', message: 'Sample vehicles and service records were added.' });
  }

  async function afterMutation(message: string): Promise<void> {
    await refresh();
    setStatus({ tone: 'success', message });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Car size={22} />
          </div>
          <div>
            <div className="brand-title">Car Care Log</div>
            <div className="brand-subtitle">Vehicle Service Binder</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeView === item.key ? 'active' : ''}`}
              onClick={() => setActiveView(item.key)}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="privacy-panel">
          <ShieldCheck size={18} />
          <div>
            <strong>Your records stay on this device.</strong>
            <p>No account, cloud sync, telemetry, or upload requirement.</p>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Private service records</p>
            <h1>{navItems.find((item) => item.key === activeView)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" onClick={loadSamples} title="Load sample data">
              <Database size={16} />
              Load sample data
            </button>
            <button className="primary-button" onClick={() => setActiveView('vehicles')} title="Add or edit vehicles">
              <Plus size={16} />
              Add vehicle
            </button>
          </div>
        </header>

        {browserPreview && (
          <div className="preview-notice">
            <Info size={18} />
            <span>Browser preview mode. Records here use this browser only; document attachment and OCR run in the desktop app window.</span>
          </div>
        )}

        {status && (
          <div className={`toast ${status.tone}`}>
            {status.tone === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
            <span>{status.message}</span>
            <button className="icon-button" onClick={() => setStatus(null)} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {firstRun && <FirstRunPanel onLoadSamples={loadSamples} onAddVehicle={() => setActiveView('vehicles')} />}

        {loading && <div className="loading-state">Opening your local records...</div>}

        {!loading && snapshot && activeView === 'dashboard' && (
          <DashboardView
            vehicles={vehicles}
            services={services}
            selectedVehicle={selectedVehicle}
            selectedVehicleId={selectedVehicle?.id ?? ''}
            onSelectVehicle={setSelectedVehicleId}
            onOpenVehicles={() => setActiveView('vehicles')}
            onOpenServices={() => setActiveView('services')}
          />
        )}

        {!loading && snapshot && activeView === 'vehicles' && (
          <VehiclesView
            vehicles={vehicles}
            services={services}
            selectedVehicleId={selectedVehicleId}
            settings={settings}
            onSelectVehicle={setSelectedVehicleId}
            onSaved={(message) => afterMutation(message)}
            onStatus={setStatus}
          />
        )}

        {!loading && snapshot && activeView === 'services' && (
          <ServiceLogView
            vehicles={vehicles}
            services={services}
            selectedVehicleId={selectedVehicle?.id ?? ''}
            settings={settings}
            onSelectVehicle={setSelectedVehicleId}
            onSaved={(message) => afterMutation(message)}
            onStatus={setStatus}
          />
        )}

        {!loading && snapshot && activeView === 'documents' && (
          <DocumentsView
            vehicles={vehicles}
            services={services}
            settings={settings}
            onSaved={(message) => afterMutation(message)}
            onStatus={setStatus}
          />
        )}

        {!loading && snapshot && activeView === 'export' && (
          <ExportBackupView vehicles={vehicles} services={services} onRefresh={refresh} onStatus={setStatus} />
        )}

        {!loading && snapshot && activeView === 'settings' && (
          <SettingsView settings={settings} onSaved={(message) => afterMutation(message)} onStatus={setStatus} />
        )}
      </main>
    </div>
  );
}

function FirstRunPanel({
  onLoadSamples,
  onAddVehicle
}: {
  onLoadSamples: () => Promise<void>;
  onAddVehicle: () => void;
}): JSX.Element {
  return (
    <section className="first-run">
      <div>
        <p className="eyebrow">First run</p>
        <h2>Start with a vehicle or try the sample records.</h2>
        <p>
          Track what was done, when, where, at what mileage, and how much it cost before approving repeat
          maintenance.
        </p>
      </div>
      <div className="button-row">
        <button className="primary-button" onClick={onAddVehicle}>
          <Plus size={16} />
          Add first vehicle
        </button>
        <button className="secondary-button" onClick={onLoadSamples}>
          <Database size={16} />
          Load sample data
        </button>
      </div>
    </section>
  );
}

function DashboardView({
  vehicles,
  services,
  selectedVehicle,
  selectedVehicleId,
  onSelectVehicle,
  onOpenVehicles,
  onOpenServices
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  selectedVehicle: Vehicle | undefined;
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  onOpenVehicles: () => void;
  onOpenServices: () => void;
}): JSX.Element {
  const servicesForSelected = services.filter((service) => service.vehicleId === selectedVehicleId);
  const recentServices = services.slice(0, 6);
  const reminders = services
    .filter((service) => service.nextRecommendedDate || service.nextRecommendedMileage)
    .sort((left, right) => (left.nextRecommendedDate || '9999').localeCompare(right.nextRecommendedDate || '9999'))
    .slice(0, 6);

  return (
    <div className="dashboard-grid">
      <section className="panel dashboard-main">
        <div className="section-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>Vehicle records</h2>
          </div>
          <button className="secondary-button" onClick={onOpenVehicles}>
            <Plus size={16} />
            Manage vehicles
          </button>
        </div>

        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Car size={26} />}
            title="No vehicles yet"
            copy="Add a vehicle to begin recording service history and receipts."
          />
        ) : (
          <div className="vehicle-card-grid">
            {vehicles.map((vehicle) => {
              const vehicleServices = services.filter((service) => service.vehicleId === vehicle.id);
              return (
                <button
                  key={vehicle.id}
                  className={`vehicle-card ${vehicle.id === selectedVehicleId ? 'selected' : ''}`}
                  onClick={() => onSelectVehicle(vehicle.id)}
                >
                  <div className="vehicle-card-top">
                    <Car size={20} />
                    <strong>{vehicle.nickname}</strong>
                  </div>
                  <span>{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}</span>
                  <div className="vehicle-card-meta">
                    <span>{vehicleServices.length} records</span>
                    <span>{formatMoney(totalSpend(vehicleServices))}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Selected vehicle</p>
            <h2>{selectedVehicle ? selectedVehicle.nickname : 'None selected'}</h2>
          </div>
        </div>
        <div className="metric-grid">
          <Metric label="Total spend" value={formatMoney(totalSpend(servicesForSelected))} />
          <Metric label="Current mileage" value={formatMileage(selectedVehicle?.currentMileage ?? null)} />
          <Metric label="Service records" value={servicesForSelected.length.toString()} />
        </div>
      </section>

      <section className="panel">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Recent</p>
            <h2>Services</h2>
          </div>
          <button className="secondary-button" onClick={onOpenServices}>
            <Wrench size={16} />
            Add service
          </button>
        </div>
        {recentServices.length === 0 ? (
          <EmptyState
            icon={<History size={24} />}
            title="No service records yet"
            copy="Add oil changes, inspections, repairs, and receipts as they happen."
          />
        ) : (
          <div className="compact-list">
            {recentServices.map((service) => (
              <ServiceListRow
                key={service.id}
                service={service}
                vehicle={vehicles.find((vehicle) => vehicle.id === service.vehicleId)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Upcoming recorded reminders</p>
            <h2>Next notes</h2>
          </div>
        </div>
        {reminders.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={24} />}
            title="No reminders recorded"
            copy="Optional next date or mileage fields will appear here."
          />
        ) : (
          <div className="compact-list">
            {reminders.map((service) => (
              <div className="list-row" key={service.id}>
                <div>
                  <strong>{service.category}</strong>
                  <span>{vehicleName(vehicles.find((vehicle) => vehicle.id === service.vehicleId))}</span>
                </div>
                <small>
                  {service.nextRecommendedDate && `Date: ${formatDate(service.nextRecommendedDate)}`}
                  {service.nextRecommendedDate && service.nextRecommendedMileage ? ' · ' : ''}
                  {service.nextRecommendedMileage && `Mileage: ${formatMileage(service.nextRecommendedMileage)}`}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel dashboard-wide">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Based on your records</p>
            <h2>Last recorded common services</h2>
          </div>
        </div>
        <LastRecordedGrid services={servicesForSelected} />
      </section>
    </div>
  );
}

function VehiclesView({
  vehicles,
  services,
  selectedVehicleId,
  settings,
  onSelectVehicle,
  onSaved,
  onStatus
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  selectedVehicleId: string;
  settings: AppSettings;
  onSelectVehicle: (id: string) => void;
  onSaved: (message: string) => Promise<void>;
  onStatus: (status: Status) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<VehicleFormState>(emptyVehicleForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];

  function editVehicle(vehicle: Vehicle): void {
    setEditingId(vehicle.id);
    setDraft(vehicleToForm(vehicle));
    onSelectVehicle(vehicle.id);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      if (editingId) {
        await window.carCareLog.updateVehicle(editingId, vehiclePayload(draft));
        setEditingId(null);
        setDraft(emptyVehicleForm());
        await onSaved('Vehicle profile updated.');
      } else {
        const created = await window.carCareLog.createVehicle(vehiclePayload(draft));
        onSelectVehicle(created.id);
        setDraft(emptyVehicleForm());
        await onSaved('Vehicle profile added.');
      }
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    }
  }

  async function deleteVehicle(vehicle: Vehicle): Promise<void> {
    const linkedServices = services.filter((service) => service.vehicleId === vehicle.id);
    const attachmentCount = linkedServices.reduce((count, service) => count + service.attachments.length, 0);
    if (
      !window.confirm(
        `Delete ${vehicle.nickname}? This removes ${linkedServices.length} service records and ${attachmentCount} attachments from local app storage. This cannot be undone.`
      )
    ) {
      return;
    }
    await window.carCareLog.deleteVehicle(vehicle.id);
    await onSaved('Vehicle deleted.');
  }

  return (
    <div className="split-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{editingId ? 'Edit profile' : 'New vehicle'}</p>
            <h2>{editingId ? 'Update vehicle' : 'Add vehicle'}</h2>
          </div>
          {editingId && (
            <button
              className="secondary-button"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyVehicleForm());
              }}
            >
              <X size={16} />
              Cancel
            </button>
          )}
        </div>
        <VehicleForm draft={draft} onChange={setDraft} onSubmit={submit} submitLabel={editingId ? 'Save changes' : 'Add vehicle'} />
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Vehicle detail</p>
            <h2>{selectedVehicle ? selectedVehicle.nickname : 'No vehicle selected'}</h2>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Car size={26} />}
            title="No vehicles yet"
            copy="Create your first vehicle profile to unlock service history and documents."
          />
        ) : (
          <>
            <div className="vehicle-list">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  className={`mini-vehicle ${vehicle.id === selectedVehicle?.id ? 'active' : ''}`}
                  onClick={() => onSelectVehicle(vehicle.id)}
                >
                  <Car size={16} />
                  <span>{vehicle.nickname}</span>
                </button>
              ))}
            </div>
            {selectedVehicle && (
              <VehicleDetail
                vehicle={selectedVehicle}
                vehicles={vehicles}
                services={services}
                settings={settings}
                onEdit={() => editVehicle(selectedVehicle)}
                onDelete={() => deleteVehicle(selectedVehicle)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function VehicleForm({
  draft,
  onChange,
  onSubmit,
  submitLabel
}: {
  draft: VehicleFormState;
  onChange: (next: VehicleFormState) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
}): JSX.Element {
  const set = (key: keyof VehicleFormState, value: string): void => onChange({ ...draft, [key]: value });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Nickname
        <input value={draft.nickname} onChange={(event) => set('nickname', event.target.value)} required />
      </label>
      <label>
        Year
        <input type="number" value={draft.year} onChange={(event) => set('year', event.target.value)} />
      </label>
      <label>
        Make
        <input value={draft.make} onChange={(event) => set('make', event.target.value)} />
      </label>
      <label>
        Model
        <input value={draft.model} onChange={(event) => set('model', event.target.value)} />
      </label>
      <label>
        Trim
        <input value={draft.trim} onChange={(event) => set('trim', event.target.value)} />
      </label>
      <label>
        VIN
        <input value={draft.vin} onChange={(event) => set('vin', event.target.value)} />
      </label>
      <label>
        License plate
        <input value={draft.licensePlate} onChange={(event) => set('licensePlate', event.target.value)} />
      </label>
      <label>
        Purchase date
        <input type="date" value={draft.purchaseDate} onChange={(event) => set('purchaseDate', event.target.value)} />
      </label>
      <label>
        Starting mileage
        <input type="number" value={draft.startingMileage} onChange={(event) => set('startingMileage', event.target.value)} />
      </label>
      <label>
        Current mileage
        <input type="number" value={draft.currentMileage} onChange={(event) => set('currentMileage', event.target.value)} />
      </label>
      <label className="span-2">
        Notes
        <textarea value={draft.notes} onChange={(event) => set('notes', event.target.value)} rows={4} />
      </label>
      <div className="form-actions span-2">
        <button className="primary-button" type="submit">
          <Save size={16} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function VehicleDetail({
  vehicle,
  vehicles,
  services,
  settings,
  onEdit,
  onDelete
}: {
  vehicle: Vehicle;
  vehicles: Vehicle[];
  services: ServiceRecord[];
  settings: AppSettings;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [shop, setShop] = useState('');
  const vehicleServices = services.filter((service) => service.vehicleId === vehicle.id);
  const filtered = vehicleServices.filter((service) => {
    if (category && service.category !== category) return false;
    if (shop && !service.shop.toLowerCase().includes(shop.toLowerCase())) return false;
    return serviceMatchesQuery(service, vehicle, query);
  });
  const attachments = vehicleServices.flatMap((service) => service.attachments);

  return (
    <div className="detail-stack">
      <div className="profile-strip">
        <div>
          <strong>{vehicleName(vehicle)}</strong>
          <span>{vehicle.vin ? `VIN ${vehicle.vin}` : 'VIN not recorded'}</span>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={onEdit}>
            <Save size={16} />
            Edit
          </button>
          <button className="danger-button" onClick={onDelete}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Total spend" value={formatMoney(totalSpend(vehicleServices))} />
        <Metric label="Service records" value={vehicleServices.length.toString()} />
        <Metric label="Attachments" value={attachments.length.toString()} />
      </div>

      <section className="subsection">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Last recorded</p>
            <h3>Common services</h3>
          </div>
        </div>
        <LastRecordedGrid services={vehicleServices} />
      </section>

      <section className="subsection">
        <div className="filter-row">
          <label>
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search category, shop, notes, documents, OCR" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {SERVICE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="Filter shop" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<ClipboardList size={24} />} title="No matching records" copy="Try a different category, shop, or keyword." />
        ) : (
          <div className="timeline">
            {filtered.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                vehicle={vehicle}
                allServices={services}
                vehicles={vehicles}
                mileageThreshold={settings.duplicateMileageThreshold}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ServiceLogView({
  vehicles,
  services,
  selectedVehicleId,
  settings,
  onSelectVehicle,
  onSaved,
  onStatus
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  selectedVehicleId: string;
  settings: AppSettings;
  onSelectVehicle: (id: string) => void;
  onSaved: (message: string) => Promise<void>;
  onStatus: (status: Status) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<ServiceFormState>(emptyServiceForm(selectedVehicleId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setDraft((current) => ({ ...current, vehicleId: current.vehicleId || selectedVehicleId }));
  }, [selectedVehicleId]);

  const vehicle = vehicles.find((item) => item.id === draft.vehicleId);
  const duplicateRisk = findDuplicateRisk({
    services,
    vehicleId: draft.vehicleId,
    category: draft.category,
    serviceDate: draft.serviceDate,
    mileage: numberOrNull(draft.mileage),
    mileageThreshold: settings.duplicateMileageThreshold,
    excludeServiceId: editingId ?? undefined
  });
  const filteredServices = services.filter((service) =>
    serviceMatchesQuery(service, vehicles.find((item) => item.id === service.vehicleId), query)
  );

  function editService(service: ServiceRecord): void {
    setEditingId(service.id);
    setDraft(serviceToForm(service));
    onSelectVehicle(service.vehicleId);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft.vehicleId) {
      onStatus({ tone: 'error', message: 'Add a vehicle before creating a service record.' });
      return;
    }
    try {
      if (editingId) {
        await window.carCareLog.updateServiceRecord(editingId, servicePayload(draft));
        setEditingId(null);
        setDraft(emptyServiceForm(draft.vehicleId));
        await onSaved('Service record updated.');
      } else {
        await window.carCareLog.createServiceRecord(servicePayload(draft));
        setDraft(emptyServiceForm(draft.vehicleId));
        await onSaved('Service record added.');
      }
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    }
  }

  async function deleteService(service: ServiceRecord): Promise<void> {
    if (
      !window.confirm(
        `Delete this ${service.category.toLowerCase()} record? This removes ${service.attachments.length} linked attachments from local app storage. This cannot be undone.`
      )
    ) {
      return;
    }
    await window.carCareLog.deleteServiceRecord(service.id);
    await onSaved('Service record deleted.');
  }

  return (
    <div className="split-layout service-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{editingId ? 'Edit service' : 'New service'}</p>
            <h2>{editingId ? 'Update record' : 'Add service record'}</h2>
          </div>
          {editingId && (
            <button
              className="secondary-button"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyServiceForm(selectedVehicleId));
              }}
            >
              <X size={16} />
              Cancel
            </button>
          )}
        </div>

        {vehicles.length === 0 ? (
          <EmptyState icon={<Car size={26} />} title="No vehicles yet" copy="Create a vehicle profile before adding service records." />
        ) : (
          <>
            {duplicateRisk.hasRisk && duplicateRisk.lastRecord && (
              <div className="notice warning">
                <Info size={18} />
                <div>
                  <strong>{duplicateRiskTitle(duplicateRisk, draft.category)}</strong>
                  <p>{duplicateRiskCopy(duplicateRisk, draft.category, settings.duplicateMileageThreshold)}</p>
                </div>
              </div>
            )}
            {!duplicateRisk.hasRisk && duplicateRisk.lastRecord && (
              <div className="notice muted">
                <Info size={18} />
                <p>{duplicateRiskCopy(duplicateRisk, draft.category, settings.duplicateMileageThreshold)}</p>
              </div>
            )}
            <ServiceForm
              draft={draft}
              vehicles={vehicles}
              onChange={(next) => {
                setDraft(next);
                if (next.vehicleId) onSelectVehicle(next.vehicleId);
              }}
              onSubmit={submit}
              submitLabel={editingId ? 'Save changes' : 'Add service'}
            />
            {vehicle && <p className="form-note">Adding this to {vehicleName(vehicle)}.</p>}
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Service history</p>
            <h2>All records</h2>
          </div>
        </div>
        <div className="filter-row single">
          <label>
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records, attachments, OCR text" />
          </label>
        </div>
        {filteredServices.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={26} />}
            title={services.length > 0 && query.trim() ? 'No records match this search' : 'No service records yet'}
            copy={
              services.length > 0 && query.trim()
                ? 'Try another category, shop, document label, or note keyword.'
                : 'Record maintenance visits, costs, notes, and reminders.'
            }
          />
        ) : (
          <div className="timeline">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                vehicle={vehicles.find((item) => item.id === service.vehicleId)}
                allServices={services}
                vehicles={vehicles}
                mileageThreshold={settings.duplicateMileageThreshold}
                onEdit={() => editService(service)}
                onDelete={() => deleteService(service)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ServiceForm({
  draft,
  vehicles,
  onChange,
  onSubmit,
  submitLabel,
  hideActions = false
}: {
  draft: ServiceFormState;
  vehicles: Vehicle[];
  onChange: (next: ServiceFormState) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  hideActions?: boolean;
}): JSX.Element {
  const set = (key: keyof ServiceFormState, value: string): void => onChange({ ...draft, [key]: value });

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label className="span-2">
        Vehicle
        <select value={draft.vehicleId} onChange={(event) => set('vehicleId', event.target.value)} required>
          <option value="">Choose vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicleName(vehicle)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Service date
        <input type="date" value={draft.serviceDate} onChange={(event) => set('serviceDate', event.target.value)} required />
      </label>
      <label>
        Mileage
        <input type="number" value={draft.mileage} onChange={(event) => set('mileage', event.target.value)} />
      </label>
      <label>
        Shop/provider
        <input value={draft.shop} onChange={(event) => set('shop', event.target.value)} />
      </label>
      <label>
        Category
        <select value={draft.category} onChange={(event) => set('category', event.target.value)}>
          {SERVICE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Service description
        <input value={draft.description} onChange={(event) => set('description', event.target.value)} />
      </label>
      <label>
        Total cost
        <input type="number" min="0" step="0.01" value={draft.totalCost} onChange={(event) => set('totalCost', event.target.value)} />
      </label>
      <label>
        Next recommended date
        <input type="date" value={draft.nextRecommendedDate} onChange={(event) => set('nextRecommendedDate', event.target.value)} />
      </label>
      <label>
        Next recommended mileage
        <input type="number" value={draft.nextRecommendedMileage} onChange={(event) => set('nextRecommendedMileage', event.target.value)} />
      </label>
      <label className="span-2">
        Notes
        <textarea value={draft.notes} onChange={(event) => set('notes', event.target.value)} rows={4} />
      </label>
      {!hideActions && (
        <div className="form-actions span-2">
          <button className="primary-button" type="submit">
            <Save size={16} />
            {submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

function DocumentsView({
  vehicles,
  services,
  settings,
  onSaved,
  onStatus
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  settings: AppSettings;
  onSaved: (message: string) => Promise<void>;
  onStatus: (status: Status) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<AttachmentFormState>({
    serviceRecordId: services[0]?.id ?? '',
    label: '',
    type: 'receipt'
  });
  const [intakeDraft, setIntakeDraft] = useState({
    vehicleId: services[0]?.vehicleId ?? vehicles[0]?.id ?? '',
    label: '',
    type: 'receipt' as AttachmentType
  });
  const [preview, setPreview] = useState<AttachmentPreview | null>(null);
  const [review, setReview] = useState<DocumentReviewState | null>(null);
  const [runningAttachmentId, setRunningAttachmentId] = useState<string | null>(null);
  const [intakeRunning, setIntakeRunning] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [reviewAction, setReviewAction] = useState<'create' | 'update' | null>(null);
  const attachments = services.flatMap((service) => service.attachments.map((attachment) => ({ attachment, service })));

  useEffect(() => {
    setDraft((current) => ({ ...current, serviceRecordId: current.serviceRecordId || services[0]?.id || '' }));
    setIntakeDraft((current) => ({ ...current, vehicleId: current.vehicleId || services[0]?.vehicleId || vehicles[0]?.id || '' }));
  }, [services, vehicles]);

  async function addAttachment(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft.serviceRecordId) {
      onStatus({ tone: 'error', message: 'Choose a service record before attaching a document.' });
      return;
    }
    setAttaching(true);
    try {
      const attachment = await window.carCareLog.chooseAndAddAttachment(draft);
      if (!attachment) {
        onStatus({ tone: 'info', message: 'Attachment selection canceled.' });
        return;
      }
      setDraft({ ...draft, label: '' });
      await onSaved('Document attached. Extract text when you are ready to review the linked record.');
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    } finally {
      setAttaching(false);
    }
  }

  async function openPreview(attachment: Attachment): Promise<void> {
    const result = await window.carCareLog.getAttachmentPreview(attachment.id);
    setPreview(result);
  }

  async function reviewAttachment(attachment: Attachment): Promise<void> {
    setRunningAttachmentId(attachment.id);
    try {
      const result =
        attachment.ocrStatus === 'extracted' || attachment.ocrStatus === 'partial'
          ? await window.carCareLog.getAttachmentReview(attachment.id)
          : await window.carCareLog.runAttachmentOcr(attachment.id);
      const attachmentPreview = await window.carCareLog.getAttachmentPreview(attachment.id);
      const service = services.find((item) => item.id === result.attachment.serviceRecordId);
      const baseDraft = service ? mergeSuggestionsIntoExistingService(serviceToForm(service), result.suggested) : suggestedToServiceForm(result.suggested, '');
      setReview({
        source: 'attachment',
        review: result,
        preview: attachmentPreview,
        draft: baseDraft
      });
      if (attachment.ocrStatus === 'extracted' || attachment.ocrStatus === 'partial') {
        onStatus({ tone: 'info', message: 'Review before saving. Suggestions are based on extracted text.' });
      } else {
        await onSaved(
          result.status === 'extracted' || result.status === 'partial'
            ? 'Text extracted locally. Review before saving.'
            : ocrStatusLabel(result.status)
        );
      }
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    } finally {
      setRunningAttachmentId(null);
    }
  }

  async function importForIntake(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!intakeDraft.vehicleId) {
      onStatus({ tone: 'error', message: 'Choose a vehicle before importing a document.' });
      return;
    }
    setIntakeRunning(true);
    try {
      const result = await window.carCareLog.chooseDocumentForIntake(intakeDraft);
      if (!result) {
        onStatus({ tone: 'info', message: 'Document import canceled.' });
        return;
      }
      setReview({
        source: 'intake',
        intake: result,
        draft: suggestedToServiceForm(result.suggested, result.vehicleId)
      });
      setIntakeDraft({ ...intakeDraft, label: '' });
      onStatus({
        tone: result.status === 'extracted' ? 'success' : 'info',
        message:
          result.status === 'extracted'
            ? 'Text extracted locally. Review before saving.'
            : result.status === 'partial'
              ? 'Some text was extracted locally. Review before saving.'
            : result.error || 'Document imported for review.'
      });
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    } finally {
      setIntakeRunning(false);
    }
  }

  async function deleteAttachment(attachment: Attachment): Promise<void> {
    if (!window.confirm(`Remove "${attachment.label}" from this service record and local app storage? This cannot be undone.`)) return;
    await window.carCareLog.deleteAttachment(attachment.id);
    await onSaved('Attachment removed.');
  }

  async function closeReview(): Promise<void> {
    if (review?.source === 'intake') {
      await window.carCareLog.discardIntake(review.intake.intakeId);
    }
    setReview(null);
  }

  async function createFromReview(): Promise<void> {
    if (!review) return;
    const payload = servicePayload(review.draft);
    if (!payload.vehicleId) {
      onStatus({ tone: 'error', message: 'Choose a vehicle before saving the reviewed service record.' });
      return;
    }
    try {
      setReviewAction('create');
      if (review.source === 'intake') {
        await window.carCareLog.createServiceFromIntake({
          intakeId: review.intake.intakeId,
          service: payload,
          attachmentLabel: review.intake.label,
          attachmentType: review.intake.type
        });
      } else {
        const created = await window.carCareLog.createServiceRecord(payload);
        await window.carCareLog.moveAttachmentToService(review.review.attachment.id, created.id);
      }
      setReview(null);
      await onSaved('Service record created from reviewed document details.');
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    } finally {
      setReviewAction(null);
    }
  }

  async function updateLinkedServiceFromReview(): Promise<void> {
    if (!review || review.source !== 'attachment') return;
    try {
      setReviewAction('update');
      await window.carCareLog.updateServiceRecord(review.review.attachment.serviceRecordId, servicePayload(review.draft));
      setReview(null);
      await onSaved('Linked service record updated from reviewed document details.');
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    } finally {
      setReviewAction(null);
    }
  }

  return (
    <div className="split-layout documents-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Document intake</p>
            <h2>Create from document</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={importForIntake}>
          <label className="span-2">
            Vehicle
            <select value={intakeDraft.vehicleId} onChange={(event) => setIntakeDraft({ ...intakeDraft, vehicleId: event.target.value })} required>
              <option value="">Choose vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleName(vehicle)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Document label
            <input
              value={intakeDraft.label}
              onChange={(event) => setIntakeDraft({ ...intakeDraft, label: event.target.value })}
              placeholder="Invoice, receipt, estimate"
            />
          </label>
          <label>
            Type
            <select value={intakeDraft.type} onChange={(event) => setIntakeDraft({ ...intakeDraft, type: event.target.value as AttachmentType })}>
              {ATTACHMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions span-2">
            <button className="primary-button" type="submit" disabled={vehicles.length === 0 || intakeRunning}>
              <FileSearch size={16} />
              {intakeRunning ? 'Extracting text locally...' : 'Import and review'}
            </button>
          </div>
        </form>
        <div className="notice muted">
          <ShieldCheck size={18} />
          <p>Text extraction runs locally on this device. Suggested fields are not saved until you review and confirm them.</p>
        </div>
        {vehicles.length === 0 && (
          <div className="notice warning">
            <Info size={18} />
            <p>Add a vehicle before importing a receipt or invoice for review.</p>
          </div>
        )}

        <div className="section-divider" />

        <div className="section-header compact">
          <div>
            <p className="eyebrow">Existing record</p>
            <h2>Add document</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={addAttachment}>
          <label className="span-2">
            Service record
            <select value={draft.serviceRecordId} onChange={(event) => setDraft({ ...draft, serviceRecordId: event.target.value })} required>
              <option value="">Choose service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {formatDate(service.serviceDate)} · {service.category} ·{' '}
                  {vehicleName(vehicles.find((vehicle) => vehicle.id === service.vehicleId))}
                </option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Receipt, invoice, estimate" />
          </label>
          <label>
            Type
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as AttachmentType })}>
              {ATTACHMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions span-2">
            <button className="primary-button" type="submit" disabled={services.length === 0 || attaching}>
              <FolderOpen size={16} />
              {attaching ? 'Attaching document...' : 'Choose file and attach'}
            </button>
          </div>
        </form>
        <div className="notice muted">
          <ShieldCheck size={18} />
          <p>Files are copied into local app storage. The original file path is not shown in the app.</p>
        </div>
        {services.length === 0 && (
          <div className="notice warning">
            <Info size={18} />
            <p>Create a service record before attaching a document to an existing record.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Documents</p>
            <h2>Receipts and records</h2>
          </div>
        </div>
        {attachments.length === 0 ? (
          <EmptyState
            icon={<FileText size={26} />}
            title="No attachments yet"
            copy="Attach receipts, invoices, inspection reports, warranty documents, and photos."
          />
        ) : (
          <div className="document-list">
            {attachments.map(({ attachment, service }) => (
              <div className="document-row" key={attachment.id}>
                <div className="document-icon">{attachment.mimeType.startsWith('image/') ? <Image size={19} /> : <FileText size={19} />}</div>
                <div className="document-body">
                  <strong>{attachment.label}</strong>
                  <span>
                    {attachment.type} · {attachment.fileType} · {formatDateTime(attachment.addedDate)}
                  </span>
                  <small>
                    {service.category} for {vehicleName(vehicles.find((vehicle) => vehicle.id === service.vehicleId))} ·{' '}
                    {ocrLabel(attachment)}
                  </small>
                </div>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => reviewAttachment(attachment)}
                    disabled={runningAttachmentId !== null}
                    aria-busy={runningAttachmentId === attachment.id}
                  >
                    <FileSearch size={16} />
                    {attachmentActionLabel(attachment, runningAttachmentId === attachment.id)}
                  </button>
                  <button className="secondary-button" onClick={() => openPreview(attachment)}>
                    <FileText size={16} />
                    Preview
                  </button>
                  <button className="danger-button" onClick={() => deleteAttachment(attachment)}>
                    <Trash2 size={16} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {preview && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="preview-modal">
            <div className="section-header compact">
              <h2>Attachment preview</h2>
              <button className="icon-button" onClick={() => setPreview(null)} title="Close preview">
                <X size={18} />
              </button>
            </div>
            {preview.previewKind === 'image' && <img className="preview-image" src={preview.dataUrl} alt="Attachment preview" />}
            {preview.previewKind === 'pdf' && <iframe className="preview-frame" src={preview.dataUrl} title="PDF preview" />}
            {preview.previewKind === 'unsupported' && (
              <EmptyState icon={<FileText size={26} />} title="Preview unavailable" copy="This file type is stored locally but cannot be previewed here yet." />
            )}
            {preview.previewKind === 'too_large' && (
              <EmptyState icon={<FileText size={26} />} title="Preview too large" copy="The document is stored locally, but this file is too large to preview safely here." />
            )}
          </div>
        </div>
      )}

      {review && (
        <DocumentReviewModal
          review={review}
          vehicles={vehicles}
          services={services}
          settings={settings}
          onDraftChange={(draft) => setReview({ ...review, draft } as DocumentReviewState)}
          onClose={closeReview}
          onCreate={createFromReview}
          onUpdateLinked={review.source === 'attachment' ? updateLinkedServiceFromReview : undefined}
          actionInProgress={reviewAction}
        />
      )}
    </div>
  );
}

function DocumentReviewModal({
  review,
  vehicles,
  services,
  settings,
  onDraftChange,
  onClose,
  onCreate,
  onUpdateLinked,
  actionInProgress
}: {
  review: DocumentReviewState;
  vehicles: Vehicle[];
  services: ServiceRecord[];
  settings: AppSettings;
  onDraftChange: (draft: ServiceFormState) => void;
  onClose: () => Promise<void>;
  onCreate: () => Promise<void>;
  onUpdateLinked?: () => Promise<void>;
  actionInProgress: 'create' | 'update' | null;
}): JSX.Element {
  const status = review.source === 'intake' ? review.intake.status : review.review.status;
  const text = review.source === 'intake' ? review.intake.text : review.review.text;
  const error = review.source === 'intake' ? review.intake.error : review.review.error;
  const suggested = review.source === 'intake' ? review.intake.suggested : review.review.suggested;
  const preview = review.source === 'intake' ? review.intake.preview : review.preview;
  const label = review.source === 'intake' ? review.intake.label : review.review.attachment.label;
  const linkedService =
    review.source === 'attachment'
      ? services.find((service) => service.id === review.review.attachment.serviceRecordId)
      : null;
  const duplicateRisk = findDuplicateRisk({
    services,
    vehicleId: review.draft.vehicleId,
    category: review.draft.category,
    serviceDate: review.draft.serviceDate,
    mileage: numberOrNull(review.draft.mileage),
    mileageThreshold: settings.duplicateMileageThreshold,
    excludeServiceId: linkedService?.id
  });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="review-modal">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Suggested from document</p>
            <h2>Review before saving</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close review">
            <X size={18} />
          </button>
        </div>

        <div className="review-grid">
          <section className="review-preview">
            <div className="review-title-row">
              <strong>{label}</strong>
              <span className={`ocr-status ${status}`}>{ocrStatusLabel(status)}</span>
            </div>
            {preview?.previewKind === 'image' && <img className="review-image" src={preview.dataUrl} alt="Imported document preview" />}
            {preview?.previewKind === 'pdf' && <iframe className="review-frame" src={preview.dataUrl} title="Imported PDF preview" />}
            {(!preview || preview.previewKind === 'unsupported') && (
              <EmptyState icon={<FileText size={24} />} title="Preview unavailable" copy="The document is stored locally, but this file type cannot be previewed here yet." />
            )}
            {preview?.previewKind === 'too_large' && (
              <EmptyState icon={<FileText size={24} />} title="Preview too large" copy="The document is stored locally, but this file is too large to preview safely here." />
            )}
            <details className="ocr-text-panel" open={Boolean(text)}>
              <summary>Extracted text</summary>
              {text ? <pre>{text}</pre> : <p>{error || 'No extracted text is available for this file.'}</p>}
            </details>
          </section>

          <section className="review-fields">
            <div className="notice muted">
              <Info size={18} />
              <p>Based on extracted text. Review before saving.</p>
            </div>
            {status === 'partial' && error && (
              <div className="notice warning">
                <Info size={18} />
                <p>{error}</p>
              </div>
            )}
            {(status === 'failed' || status === 'unavailable') && error && (
              <div className="notice warning">
                <Info size={18} />
                <p>{error}</p>
              </div>
            )}
            {linkedService && (
              <div className="notice muted">
                <Info size={18} />
                <p>
                  This document is attached to {formatDate(linkedService.serviceDate)} {linkedService.category} for{' '}
                  {vehicleName(vehicles.find((vehicle) => vehicle.id === linkedService.vehicleId))}. Updating keeps it there.
                  Creating a separate service record moves this document to the new record.
                </p>
              </div>
            )}
            {duplicateRisk.hasRisk && duplicateRisk.lastRecord && (
              <div className="notice warning">
                <Info size={18} />
                <div>
                  <strong>{duplicateRiskTitle(duplicateRisk, review.draft.category)}</strong>
                  <p>{duplicateRiskCopy(duplicateRisk, review.draft.category, settings.duplicateMileageThreshold)}</p>
                </div>
              </div>
            )}

            <ConfidenceGrid suggested={suggested} />
            <ServiceForm
              draft={review.draft}
              vehicles={vehicles}
              onChange={onDraftChange}
              onSubmit={(event) => event.preventDefault()}
              submitLabel="Review fields"
              hideActions
            />
            <div className="review-actions">
              {onUpdateLinked && (
                <button className="secondary-button" onClick={onUpdateLinked} disabled={actionInProgress !== null}>
                  <Save size={16} />
                  {actionInProgress === 'update' ? 'Updating linked record...' : 'Update linked record'}
                </button>
              )}
              <button className="primary-button" onClick={onCreate} disabled={actionInProgress !== null}>
                <Plus size={16} />
                {actionInProgress === 'create'
                  ? 'Saving service record...'
                  : review.source === 'attachment'
                    ? 'Create separate service record'
                    : 'Create service record'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ConfidenceGrid({ suggested }: { suggested: SuggestedServiceFields }): JSX.Element {
  const rows: Array<{ label: string; confidence: OcrConfidence; evidence: string }> = [
    { label: 'Date', confidence: suggested.serviceDate.confidence, evidence: suggested.serviceDate.evidence },
    { label: 'Mileage', confidence: suggested.mileage.confidence, evidence: suggested.mileage.evidence },
    { label: 'Shop', confidence: suggested.shop.confidence, evidence: suggested.shop.evidence },
    { label: 'Category', confidence: suggested.category.confidence, evidence: suggested.category.evidence },
    { label: 'Description', confidence: suggested.description.confidence, evidence: suggested.description.evidence },
    { label: 'Cost', confidence: suggested.totalCost.confidence, evidence: suggested.totalCost.evidence },
    { label: 'Next date', confidence: suggested.nextRecommendedDate.confidence, evidence: suggested.nextRecommendedDate.evidence },
    {
      label: 'Next mileage',
      confidence: suggested.nextRecommendedMileage.confidence,
      evidence: suggested.nextRecommendedMileage.evidence
    }
  ];

  return (
    <div className="confidence-grid">
      {rows.map(({ label, confidence, evidence }) => (
        <div className="confidence-item" key={label}>
          <div className="confidence-item-header">
            <span>{label}</span>
            <strong className={`confidence ${confidence}`}>{confidenceLabel(confidence)}</strong>
          </div>
          {evidence ? (
            <p className="evidence-snippet">
              <span>Evidence snippet</span>
              <q>{evidence}</q>
            </p>
          ) : (
            <p className="evidence-empty">No clear snippet found.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ExportBackupView({
  vehicles,
  services,
  onRefresh,
  onStatus
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  onRefresh: () => Promise<void>;
  onStatus: (status: Status) => void;
}): JSX.Element {
  async function exportCsv(): Promise<void> {
    try {
      const result = await window.carCareLog.exportCsv();
      if (!result) {
        onStatus({ tone: 'info', message: 'CSV export canceled.' });
        return;
      }
      onStatus({ tone: 'success', message: `CSV exported: ${result.fileName} (${result.rowCount} records).` });
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    }
  }

  async function createBackup(): Promise<void> {
    try {
      const result = await window.carCareLog.createBackup();
      if (!result) {
        onStatus({ tone: 'info', message: 'Backup canceled.' });
        return;
      }
      onStatus({
        tone: 'success',
        message: `Local backup created: ${result.backupName} (${result.vehicleCount} vehicles, ${result.serviceCount} services).`
      });
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    }
  }

  async function restoreBackup(): Promise<void> {
    if (
      !window.confirm(
        'Restore from a local backup folder? This replaces the current local records and attachments. Create a backup first if you need to keep the current records.'
      )
    ) {
      return;
    }
    try {
      const result = await window.carCareLog.restoreBackup();
      if (!result) {
        onStatus({ tone: 'info', message: 'Restore canceled.' });
        return;
      }
      await onRefresh();
      onStatus({
        tone: 'success',
        message: `Backup restored: ${result.backupName} (${result.vehicleCount} vehicles, ${result.serviceCount} services).`
      });
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    }
  }

  return (
    <div className="export-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Export</p>
            <h2>Service history files</h2>
          </div>
        </div>
        <div className="action-grid">
          <button className="action-tile" onClick={exportCsv}>
            <Download size={22} />
            <strong>Export CSV</strong>
            <span>Save service records for spreadsheets or your own archive.</span>
          </button>
          <button className="action-tile" onClick={() => window.print()}>
            <Printer size={22} />
            <strong>Print summary</strong>
            <span>Print a clean service history for resale or mechanic visits.</span>
          </button>
        </div>
        <div className="notice muted">
          <Info size={18} />
          <p>More export formats are planned after the CSV and print summary are reviewed.</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Local backup</p>
            <h2>Backup and restore</h2>
          </div>
        </div>
        <div className="action-grid">
          <button className="action-tile" onClick={createBackup}>
            <ArchiveRestore size={22} />
            <strong>Create backup folder</strong>
            <span>Copy the local database and attachments to a folder you choose.</span>
          </button>
          <button className="action-tile" onClick={restoreBackup}>
            <Upload size={22} />
            <strong>Restore backup</strong>
            <span>Replace local records from a previous Car Care Log backup folder.</span>
          </button>
        </div>
        <div className="notice warning">
          <ShieldCheck size={18} />
          <p>Backup and restore are local only. Nothing is uploaded or synced.</p>
        </div>
      </section>

      <section className="panel print-summary">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Printable summary</p>
            <h2>Vehicle service history</h2>
          </div>
        </div>
        <PrintableSummary vehicles={vehicles} services={services} />
      </section>
    </div>
  );
}

function SettingsView({
  settings,
  onSaved,
  onStatus
}: {
  settings: AppSettings;
  onSaved: (message: string) => Promise<void>;
  onStatus: (status: Status) => void;
}): JSX.Element {
  const [threshold, setThreshold] = useState(settings.duplicateMileageThreshold.toString());

  async function saveSettings(event: FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await window.carCareLog.updateSettings({ duplicateMileageThreshold: numberOrNull(threshold) ?? 0 });
      await onSaved('Settings saved.');
    } catch (error) {
      onStatus({ tone: 'error', message: userSafeErrorMessage(error) });
    }
  }

  return (
    <div className="settings-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Duplicate warnings</p>
            <h2>Related service window</h2>
          </div>
        </div>
        <form className="form-grid compact-form" onSubmit={saveSettings}>
          <label>
            Mileage threshold in miles
            <input type="number" min="0" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Save size={16} />
              Save settings
            </button>
          </div>
        </form>
        <p className="form-note">
          The app surfaces related records within 24 months or within this mileage range when mileage is available. This is only a review prompt.
        </p>
      </section>

      <section className="panel">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2>Local-first by design</h2>
          </div>
        </div>
        <div className="privacy-copy">
          <p>No user account, cloud sync, telemetry, analytics, VIN lookup, pricing service, diagnostics, or external database.</p>
          <p>Attachments are copied into local app storage. OCR runs locally for PNG/JPEG images, PDFs, and text files.</p>
          <p>This app organizes your records. It does not tell you that a service is definitely needed or not needed.</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header compact">
          <div>
            <p className="eyebrow">Document review</p>
            <h2>Receipt intake</h2>
          </div>
        </div>
        <div className="status-grid">
          <Metric label="Local OCR" value="PNG/JPEG, PDF, text" />
          <Metric label="Review" value="Confirm before saving" />
          <Metric label="PDF handling" value="Text first, local scan fallback" />
        </div>
      </section>
    </div>
  );
}

function ServiceCard({
  service,
  vehicle,
  allServices,
  vehicles,
  mileageThreshold,
  onEdit,
  onDelete
}: {
  service: ServiceRecord;
  vehicle: Vehicle | undefined;
  allServices: ServiceRecord[];
  vehicles: Vehicle[];
  mileageThreshold: number;
  onEdit?: () => void;
  onDelete?: () => void;
}): JSX.Element {
  const prior = findPriorRelatedService(allServices, service, mileageThreshold);

  return (
    <article className="service-card">
      <div className="service-card-header">
        <div>
          <span className="category-pill">{service.category}</span>
          <h3>{service.description || service.category}</h3>
          <p>{vehicleName(vehicle)}</p>
        </div>
        <div className="service-date">
          <strong>{formatDate(service.serviceDate)}</strong>
          <span>{formatMileage(service.mileage)}</span>
        </div>
      </div>
      <div className="service-meta">
        <span>
          <Wrench size={14} />
          {service.shop || 'Shop not recorded'}
        </span>
        <span>
          <Gauge size={14} />
          {formatMoney(service.totalCost)}
        </span>
        <span>
          <FileText size={14} />
          {service.attachments.length} attachments
        </span>
      </div>
      {service.notes && <p className="service-notes">{service.notes}</p>}
      {prior.lastRecord && (
        <div className={prior.hasRisk ? 'notice warning inline' : 'notice muted inline'}>
          <Info size={16} />
          <p>
            {duplicateRiskTitle(prior, service.category)}: {duplicateRiskCopy(prior, service.category, mileageThreshold)}
          </p>
        </div>
      )}
      {service.nextRecommendedDate || service.nextRecommendedMileage ? (
        <div className="next-note">
          <CalendarClock size={15} />
          <span>
            Recorded next reminder:{' '}
            {service.nextRecommendedDate && formatDate(service.nextRecommendedDate)}
            {service.nextRecommendedDate && service.nextRecommendedMileage ? ' · ' : ''}
            {service.nextRecommendedMileage && formatMileage(service.nextRecommendedMileage)}
          </span>
        </div>
      ) : null}
      {service.attachments.length > 0 && (
        <div className="attachment-chips">
          {service.attachments.map((attachment) => (
            <span key={attachment.id}>
              <FileText size={13} />
              {attachment.label} · {ocrLabel(attachment)}
            </span>
          ))}
        </div>
      )}
      {(onEdit || onDelete) && (
        <div className="card-actions">
          {onEdit && (
            <button className="secondary-button" onClick={onEdit}>
              <Save size={16} />
              Edit
            </button>
          )}
          {onDelete && (
            <button className="danger-button" onClick={onDelete}>
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      )}
      <span className="sr-only">{vehicles.length} vehicles available</span>
    </article>
  );
}

function ServiceListRow({ service, vehicle }: { service: ServiceRecord; vehicle: Vehicle | undefined }): JSX.Element {
  return (
    <div className="list-row">
      <div>
        <strong>{service.category}</strong>
        <span>{service.description || vehicleName(vehicle)}</span>
      </div>
      <small>
        {formatDate(service.serviceDate)} · {formatMoney(service.totalCost)}
      </small>
    </div>
  );
}

function LastRecordedGrid({ services }: { services: ServiceRecord[] }): JSX.Element {
  const rows = lastServicesByCategory(services);
  return (
    <div className="last-grid">
      {rows.map(({ category, service }) => (
        <div className="last-item" key={category}>
          <span>{category}</span>
          {service ? (
            <strong>
              {formatDate(service.serviceDate)} · {formatMileage(service.mileage)}
            </strong>
          ) : (
            <strong>Not recorded</strong>
          )}
        </div>
      ))}
    </div>
  );
}

function PrintableSummary({ vehicles, services }: { vehicles: Vehicle[]; services: ServiceRecord[] }): JSX.Element {
  return (
    <div className="print-body">
      {vehicles.length === 0 ? (
        <p>No vehicles recorded.</p>
      ) : (
        vehicles.map((vehicle) => {
          const vehicleServices = services.filter((service) => service.vehicleId === vehicle.id);
          return (
            <section key={vehicle.id} className="print-vehicle">
              <h3>{vehicleName(vehicle)}</h3>
              <p>
                Current mileage: {formatMileage(vehicle.currentMileage)} · Total spend: {formatMoney(totalSpend(vehicleServices))}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mileage</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Shop</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleServices.map((service) => (
                    <tr key={service.id}>
                      <td>{formatDate(service.serviceDate)}</td>
                      <td>{formatMileage(service.mileage)}</td>
                      <td>{service.category}</td>
                      <td>{service.description}</td>
                      <td>{service.shop}</td>
                      <td>{formatMoney(service.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }): JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function attachmentActionLabel(attachment: Attachment, isRunning: boolean): string {
  if (isRunning) return 'Extracting text locally...';
  if (attachment.ocrStatus === 'extracted') return 'Review extracted text';
  if (attachment.ocrStatus === 'partial') return 'Review partial text';
  if (attachment.ocrStatus === 'failed') return 'Retry text extraction';
  if (attachment.ocrStatus === 'unavailable') return 'Check text extraction';
  return 'Extract text for review';
}

function confidenceLabel(confidence: OcrConfidence): string {
  if (confidence === 'high') return 'Likely';
  if (confidence === 'medium') return 'Possible';
  if (confidence === 'low') return 'Unclear';
  return 'Review needed';
}

function ocrLabel(attachment: Attachment): string {
  if (attachment.ocrStatus === 'running') return 'Text extraction in progress';
  if (attachment.ocrStatus === 'extracted') return 'Text available for review';
  if (attachment.ocrStatus === 'partial') return 'Partial text available for review';
  if (attachment.ocrStatus === 'failed') return 'Text extraction needs review';
  if (attachment.ocrStatus === 'unavailable') return 'Text extraction unavailable';
  return 'Text not extracted yet';
}

function ocrStatusLabel(status: Attachment['ocrStatus']): string {
  if (status === 'running') return 'Extracting text locally';
  if (status === 'extracted') return 'Text extracted';
  if (status === 'partial') return 'Partial text extracted';
  if (status === 'failed') return 'Text extraction needs review';
  if (status === 'unavailable') return 'Text extraction unavailable';
  return 'Text not extracted';
}

export default App;
