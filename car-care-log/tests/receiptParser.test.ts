import { describe, expect, it } from 'vitest';
import { classifyServiceCategory, suggestServiceFieldsFromOcr } from '../shared/receiptParser';

describe('receipt OCR parser', () => {
  it('extracts likely service fields from a common invoice layout', () => {
    const suggested = suggestServiceFieldsFromOcr(`
      NORTHSIDE AUTO SERVICE
      Invoice Date: 03/12/2026
      Odometer: 54,820 miles
      Coolant flush and cooling system check
      Subtotal 174.50
      Tax 14.90
      Total Due $189.40
      Recommended next service at 70,000 miles
    `);

    expect(suggested.shop.value).toBe('NORTHSIDE AUTO SERVICE');
    expect(suggested.serviceDate.value).toBe('2026-03-12');
    expect(suggested.mileage.value).toBe(54820);
    expect(suggested.category.value).toBe('Coolant');
    expect(suggested.totalCost.value).toBe(189.4);
    expect(suggested.nextRecommendedMileage.value).toBe(70000);
  });

  it('handles common repair-order wording and payment totals', () => {
    const suggested = suggestServiceFieldsFromOcr(`
      BAY AREA QUICK LUBE
      123 Main Street
      RO Opened: Mar 12, 2026
      Odometer In 54,820
      LOF SYNTHETIC OIL & FILTER
      Cabin air filter declined
      AMOUNT PAID 89.95
      Paid with Visa ending 1234
    `);

    expect(suggested.shop.value).toBe('BAY AREA QUICK LUBE');
    expect(suggested.serviceDate.value).toBe('2026-03-12');
    expect(suggested.mileage.value).toBe(54820);
    expect(suggested.category.value).toBe('Oil change');
    expect(suggested.totalCost.value).toBe(89.95);
  });

  it('prefers closed repair-order dates, odometer out, grand totals, and records the RO number in notes', () => {
    const suggested = suggestServiceFieldsFromOcr(`
      HARBOR FAMILY AUTO
      Repair Order # RO-88421
      Opened: 04/02/26  8:13 AM
      Closed: 04/03/2026  5:44 PM
      Odometer In/Out: 81,234 / 81,241

      LABOR
      JOB 1 - BRAKE FLUID EXCHANGE
      Flush hydraulic system
      Install DOT-4 brake fluid

      PARTS
      BF004 DOT 4 Brake Fluid  2.00  28.00
      Shop supplies 9.12
      Subtotal 188.00
      Tax 6.54
      Grand Total $194.54
      Balance Due $0.00
      Amount Paid $194.54
    `);

    expect(suggested.shop.value).toBe('HARBOR FAMILY AUTO');
    expect(suggested.serviceDate.value).toBe('2026-04-03');
    expect(suggested.mileage.value).toBe(81241);
    expect(suggested.category.value).toBe('Brake fluid');
    expect(suggested.description.value).toContain('BRAKE FLUID EXCHANGE');
    expect(suggested.description.value).toContain('DOT-4 brake fluid');
    expect(suggested.totalCost.value).toBe(194.54);
    expect(suggested.notes.value).toContain('Repair order RO-88421.');
  });

  it('handles split operation lines and amount-paid totals when balance due is zero', () => {
    const suggested = suggestServiceFieldsFromOcr(`
      OAK RIDGE DEALER SERVICE
      R.O. No. 735190
      RO Opened
      May 1, 2026
      Completed: May 02, 2026
      ODO IN 102,450 OUT 102,457

      OPERATION A
      TRANSMISSION
      Drain and fill automatic transmission
      Replace CVT fluid

      Labor total 145.00
      Parts total 96.25
      Balance Due 0.00
      AMOUNT PAID
      $257.38
    `);

    expect(suggested.serviceDate.value).toBe('2026-05-02');
    expect(suggested.mileage.value).toBe(102457);
    expect(suggested.category.value).toBe('Transmission');
    expect(suggested.description.value).toContain('TRANSMISSION');
    expect(suggested.description.value).toContain('Drain and fill automatic transmission');
    expect(suggested.totalCost.value).toBe(257.38);
    expect(suggested.notes.value).toContain('735190');
  });

  it('classifies specific categories before broad related categories', () => {
    expect(classifyServiceCategory('brake fluid flush DOT 4').value).toBe('Brake fluid');
    expect(classifyServiceCategory('front brake pads and rotors').value).toBe('Brakes');
    expect(classifyServiceCategory('rotate tires and balance').value).toBe('Tire rotation');
    expect(classifyServiceCategory('new tires mounted and balanced').value).toBe('Tires');
    expect(classifyServiceCategory('coolant exchange service').value).toBe('Coolant');
    expect(classifyServiceCategory('transmission service with ATF exchange').value).toBe('Transmission');
    expect(classifyServiceCategory('state safety inspection and emissions').value).toBe('Inspection/emissions');
  });

  it('classifies common invoice shorthand across maintenance categories', () => {
    expect(classifyServiceCategory('L.O.F. full synthetic 0W20 with filter').value).toBe('Oil change');
    expect(classifyServiceCategory('cooling system service with Dex-Cool antifreeze').value).toBe('Coolant');
    expect(classifyServiceCategory('DOT-3 hydraulic brake fluid exchange').value).toBe('Brake fluid');
    expect(classifyServiceCategory('rear calipers brake job').value).toBe('Brakes');
    expect(classifyServiceCategory('rot & bal all four tires').value).toBe('Tire rotation');
    expect(classifyServiceCategory('replace AGM battery and charging system test').value).toBe('Battery');
    expect(classifyServiceCategory('engine air filter and cabin air filter replacement').value).toBe('Filters');
    expect(classifyServiceCategory('OBD emissions test and safety inspection sticker').value).toBe('Inspection/emissions');
  });

  it('returns editable low-confidence defaults when text is sparse', () => {
    const suggested = suggestServiceFieldsFromOcr('Thank you for your business');

    expect(suggested.category.value).toBe('Other');
    expect(suggested.category.confidence).toBe('low');
    expect(suggested.totalCost.value).toBeNull();
    expect(suggested.serviceDate.value).toBe('');
  });

  it('does not confuse service dates or page labels for mileage and shop names', () => {
    const suggested = suggestServiceFieldsFromOcr(`
      Page 1
      RIVER CITY AUTO
      Date/Miles In: 04/02/2026 81,234
      Coolant exchange
      Total Due $155.20
    `);

    expect(suggested.shop.value).toBe('RIVER CITY AUTO');
    expect(suggested.serviceDate.value).toBe('2026-04-02');
    expect(suggested.mileage.value).toBe(81234);
  });

  it('ignores impossible calendar dates instead of saving them as suggestions', () => {
    const suggested = suggestServiceFieldsFromOcr(`
      WESTSIDE AUTO
      Invoice Date: 02/31/2026
      Battery replacement
      Total $211.00
    `);

    expect(suggested.serviceDate.value).toBe('');
    expect(suggested.category.value).toBe('Battery');
  });
});
