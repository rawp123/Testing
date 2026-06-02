import type { AppSnapshot, Attachment, ServiceRecord, ServiceRecordInput, Vehicle, VehicleInput } from './types';

export interface SampleVehicleBundle {
  vehicle: VehicleInput;
  services: Omit<ServiceRecordInput, 'vehicleId'>[];
}

interface SampleAttachmentSeed {
  label: string;
  type: Attachment['type'];
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  ocrStatus: Attachment['ocrStatus'];
  ocrText: string;
  ocrError: string;
}

const TUTORIAL_TIMESTAMP = '2026-05-01T16:00:00.000Z';
export const TUTORIAL_SETTINGS = { duplicateMileageThreshold: 15000 };

export const SAMPLE_DATA: SampleVehicleBundle[] = [
  {
    vehicle: {
      nickname: 'Honda CR-V',
      year: 2018,
      make: 'Honda',
      model: 'CR-V',
      trim: 'EX-L',
      vin: '',
      licensePlate: '',
      purchaseDate: '2021-05-14',
      startingMileage: 34220,
      currentMileage: 58740,
      notes: 'Daily family vehicle. Sample records show routine maintenance plus a coolant duplicate-risk example.'
    },
    services: [
      {
        serviceDate: '2025-02-18',
        mileage: 42180,
        shop: 'Northside Auto',
        category: 'Coolant',
        description: 'Coolant drain and refill with pressure test',
        totalCost: 214.37,
        notes: 'First coolant-related record in the sample duplicate-risk scenario.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      },
      {
        serviceDate: '2025-07-09',
        mileage: 47610,
        shop: 'Honda Service Center',
        category: 'Oil change',
        description: 'Synthetic oil and filter change',
        totalCost: 86.42,
        notes: 'Multipoint inspection noted rear tires at 6/32.',
        nextRecommendedDate: '2026-01-09',
        nextRecommendedMileage: 53610
      },
      {
        serviceDate: '2026-01-12',
        mileage: 53510,
        shop: 'Northside Auto',
        category: 'Brakes',
        description: 'Front brake pads and rotors',
        totalCost: 612.5,
        notes: 'Front axle only. Rear brakes marked okay on invoice.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      },
      {
        serviceDate: '2026-03-12',
        mileage: 54820,
        shop: 'Northside Auto',
        category: 'Coolant',
        description: 'Coolant service noted during annual visit',
        totalCost: 189.4,
        notes: 'Second coolant-related record within 24 months for duplicate-risk context.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      }
    ]
  },
  {
    vehicle: {
      nickname: 'Toyota Camry',
      year: 2016,
      make: 'Toyota',
      model: 'Camry',
      trim: 'SE',
      vin: '',
      licensePlate: '',
      purchaseDate: '2020-08-03',
      startingMileage: 58900,
      currentMileage: 97380,
      notes: 'Commuter sedan with mostly predictable maintenance and tire records.'
    },
    services: [
      {
        serviceDate: '2025-04-03',
        mileage: 82770,
        shop: 'Downtown Tire',
        category: 'Tire rotation',
        description: 'Rotate and balance tires',
        totalCost: 49.99,
        notes: 'No uneven wear noted.',
        nextRecommendedDate: '',
        nextRecommendedMileage: 88770
      },
      {
        serviceDate: '2025-08-22',
        mileage: 87240,
        shop: 'Quick Lube Center',
        category: 'Oil change',
        description: 'Oil and filter change',
        totalCost: 68.31,
        notes: 'Cabin filter recommended but not replaced at this visit.',
        nextRecommendedDate: '2026-02-22',
        nextRecommendedMileage: 93240
      },
      {
        serviceDate: '2026-02-06',
        mileage: 95680,
        shop: 'Toyota Independent Service',
        category: 'Filters',
        description: 'Engine air filter and cabin air filter',
        totalCost: 118.2,
        notes: 'Receipt includes both filter part numbers.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      }
    ]
  },
  {
    vehicle: {
      nickname: 'Ford F-150',
      year: 2021,
      make: 'Ford',
      model: 'F-150',
      trim: 'XLT',
      vin: '',
      licensePlate: '',
      purchaseDate: '2023-02-18',
      startingMileage: 21450,
      currentMileage: 46220,
      notes: 'Truck used for weekend projects and towing. Sample records include inspection and drivetrain service.'
    },
    services: [
      {
        serviceDate: '2025-03-15',
        mileage: 33240,
        shop: 'County Inspection Station',
        category: 'Inspection/emissions',
        description: 'Annual safety inspection and emissions test',
        totalCost: 39.95,
        notes: 'Passed inspection. Sticker renewed.',
        nextRecommendedDate: '2026-03-15',
        nextRecommendedMileage: null
      },
      {
        serviceDate: '2025-09-02',
        mileage: 40780,
        shop: 'Ford Truck Service',
        category: 'Transmission',
        description: 'Transmission fluid service',
        totalCost: 326.18,
        notes: 'Performed ahead of towing trip.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      },
      {
        serviceDate: '2026-01-27',
        mileage: 44910,
        shop: 'Downtown Tire',
        category: 'Tires',
        description: 'Four all-terrain tires installed',
        totalCost: 1184.64,
        notes: 'Includes road hazard warranty.',
        nextRecommendedDate: '',
        nextRecommendedMileage: 50910
      }
    ]
  },
  {
    vehicle: {
      nickname: 'Mazda MX-5',
      year: 2009,
      make: 'Mazda',
      model: 'MX-5 Miata',
      trim: 'Grand Touring',
      vin: '',
      licensePlate: '',
      purchaseDate: '2024-04-20',
      startingMileage: 78120,
      currentMileage: 84260,
      notes: 'Older weekend car. Sample records show age-related maintenance and small repairs.'
    },
    services: [
      {
        serviceDate: '2025-05-12',
        mileage: 80140,
        shop: 'Independent Mazda Specialist',
        category: 'Battery',
        description: 'Battery replacement',
        totalCost: 184.77,
        notes: 'Old battery failed load test after winter storage.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      },
      {
        serviceDate: '2025-10-18',
        mileage: 82610,
        shop: 'Independent Mazda Specialist',
        category: 'Brake fluid',
        description: 'Brake fluid flush',
        totalCost: 142,
        notes: 'Fluid was dark; pedal feel improved after service.',
        nextRecommendedDate: '2027-10-18',
        nextRecommendedMileage: null
      },
      {
        serviceDate: '2026-04-04',
        mileage: 83980,
        shop: 'Glass & Wiper Supply',
        category: 'Wipers',
        description: 'Wiper blade replacement',
        totalCost: 34.58,
        notes: 'Installed before spring inspection.',
        nextRecommendedDate: '',
        nextRecommendedMileage: null
      }
    ]
  }
];

const TUTORIAL_ATTACHMENTS: Record<string, SampleAttachmentSeed[]> = {
  '0:1': [
    {
      label: 'Oil change receipt',
      type: 'receipt',
      fileType: 'PDF',
      mimeType: 'application/pdf',
      sizeBytes: 184_220,
      ocrStatus: 'extracted',
      ocrText: [
        'Honda Service Center',
        'Invoice Date 07/09/2025',
        'Vehicle 2018 Honda CR-V',
        'Mileage 47,610',
        'Full synthetic oil and filter change',
        'Total $86.42',
        'Next service due 01/09/2026 or 53,610 miles'
      ].join('\n'),
      ocrError: ''
    }
  ],
  '0:3': [
    {
      label: 'Coolant invoice scan',
      type: 'invoice',
      fileType: 'JPG',
      mimeType: 'image/jpeg',
      sizeBytes: 932_480,
      ocrStatus: 'partial',
      ocrText: [
        'Northside Auto',
        'RO Closed 03/12/2026',
        'Mileage 54,820',
        'Coolant service noted during annual visit',
        'Cooling system pressure check',
        'Total $189.40'
      ].join('\n'),
      ocrError: 'Only the first page was readable in this tutorial scan.'
    }
  ],
  '1:2': [
    {
      label: 'Filter invoice',
      type: 'invoice',
      fileType: 'PDF',
      mimeType: 'application/pdf',
      sizeBytes: 246_980,
      ocrStatus: 'not_run',
      ocrText: '',
      ocrError: ''
    }
  ],
  '2:2': [
    {
      label: 'Tire warranty document',
      type: 'warranty document',
      fileType: 'PDF',
      mimeType: 'application/pdf',
      sizeBytes: 512_600,
      ocrStatus: 'extracted',
      ocrText: [
        'Downtown Tire',
        'Completed 01/27/2026',
        'Mileage 44,910',
        'Four all-terrain tires installed',
        'Road hazard warranty included',
        'Total $1,184.64',
        'Rotate at 50,910 miles'
      ].join('\n'),
      ocrError: ''
    }
  ],
  '3:0': [
    {
      label: 'Battery receipt photo',
      type: 'receipt',
      fileType: 'PNG',
      mimeType: 'image/png',
      sizeBytes: 1_420_300,
      ocrStatus: 'failed',
      ocrText: '',
      ocrError: 'The photo is too dark in this tutorial example. Retake or enter the details manually.'
    }
  ]
};

function tutorialId(prefix: string, bundleIndex: number, itemIndex?: number): string {
  return itemIndex === undefined ? `${prefix}-${bundleIndex + 1}` : `${prefix}-${bundleIndex + 1}-${itemIndex + 1}`;
}

function tutorialTimestamp(offsetMinutes: number): string {
  return new Date(Date.parse(TUTORIAL_TIMESTAMP) + offsetMinutes * 60_000).toISOString();
}

function createTutorialAttachment(seed: SampleAttachmentSeed, serviceId: string, bundleIndex: number, serviceIndex: number, attachmentIndex: number): Attachment {
  const timestamp = tutorialTimestamp(bundleIndex * 30 + serviceIndex * 4 + attachmentIndex);
  return {
    id: tutorialId('tutorial-attachment', bundleIndex, serviceIndex * 10 + attachmentIndex),
    serviceRecordId: serviceId,
    label: seed.label,
    type: seed.type,
    addedDate: timestamp,
    fileType: seed.fileType,
    mimeType: seed.mimeType,
    sizeBytes: seed.sizeBytes,
    ocrStatus: seed.ocrStatus,
    ocrText: seed.ocrText,
    ocrError: seed.ocrError,
    ocrRunAt: seed.ocrStatus === 'not_run' ? '' : timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createTutorialSnapshot(): AppSnapshot {
  const vehicles: Vehicle[] = [];
  const services: ServiceRecord[] = [];

  SAMPLE_DATA.forEach((bundle, bundleIndex) => {
    const vehicleId = tutorialId('tutorial-vehicle', bundleIndex);
    const vehicleTimestamp = tutorialTimestamp(bundleIndex);
    vehicles.push({
      ...bundle.vehicle,
      id: vehicleId,
      createdAt: vehicleTimestamp,
      updatedAt: vehicleTimestamp
    });

    bundle.services.forEach((service, serviceIndex) => {
      const serviceId = tutorialId('tutorial-service', bundleIndex, serviceIndex);
      const serviceTimestamp = tutorialTimestamp(bundleIndex * 30 + serviceIndex);
      const attachmentSeeds = TUTORIAL_ATTACHMENTS[`${bundleIndex}:${serviceIndex}`] ?? [];
      services.push({
        ...service,
        id: serviceId,
        vehicleId,
        createdAt: serviceTimestamp,
        updatedAt: serviceTimestamp,
        attachments: attachmentSeeds.map((seed, attachmentIndex) =>
          createTutorialAttachment(seed, serviceId, bundleIndex, serviceIndex, attachmentIndex)
        )
      });
    });
  });

  return {
    vehicles,
    services: services.sort((left, right) => {
      const byDate = right.serviceDate.localeCompare(left.serviceDate);
      if (byDate !== 0) return byDate;
      return (right.mileage ?? 0) - (left.mileage ?? 0);
    }),
    settings: TUTORIAL_SETTINGS
  };
}
