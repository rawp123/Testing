import type { ServiceRecordInput, VehicleInput } from './types';

export interface SampleVehicleBundle {
  vehicle: VehicleInput;
  services: Omit<ServiceRecordInput, 'vehicleId'>[];
}

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
