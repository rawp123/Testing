import type { PropertyInput, PropertyRecord } from "../api/types";
import { formatCents, formatDate, toInteger } from "../utils/format";

export interface PropertyFormValues {
  name: string;
  displayAddress: string;
  purchaseDate: string;
  purchasePrice: string;
  notes: string;
  isPrimary: boolean;
}

export interface PropertyRow {
  id: string;
  name: string;
  address: string;
  purchaseDate: string;
  purchasePrice: string;
  status: string;
  isPrimary: boolean;
  source: PropertyRecord;
}

export function toPropertyRows(properties: PropertyRecord[]): PropertyRow[] {
  return properties.map((property) => ({
    id: property.id,
    name: property.name || "Untitled property",
    address: property.display_address || "No address",
    purchaseDate: property.purchase_date ? formatDate(property.purchase_date) : "No date",
    purchasePrice: property.purchase_price_cents === null || property.purchase_price_cents === undefined
      ? "No price"
      : formatCents(property.purchase_price_cents),
    status: property.archived_at ? "Archived" : "Active",
    isPrimary: Boolean(property.is_primary),
    source: property
  }));
}

export function propertyToFormValues(property?: PropertyRecord | null): PropertyFormValues {
  return {
    name: property?.name || "",
    displayAddress: property?.display_address || "",
    purchaseDate: property?.purchase_date || "",
    purchasePrice: property?.purchase_price_cents === null || property?.purchase_price_cents === undefined
      ? ""
      : centsToDollarInput(property.purchase_price_cents),
    notes: property?.notes || "",
    isPrimary: Boolean(property?.is_primary)
  };
}

export function formValuesToPropertyInput(values: PropertyFormValues): PropertyInput {
  return {
    name: values.name.trim(),
    display_address: nullableText(values.displayAddress),
    purchase_date: nullableText(values.purchaseDate),
    purchase_price_cents: dollarsToCents(values.purchasePrice),
    currency_code: "USD",
    notes: nullableText(values.notes),
    is_primary: values.isPrimary
  };
}

export function centsToDollarInput(value: number | string | null | undefined) {
  const cents = toInteger(value);
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${dollars}.${remainder}`;
}

export function dollarsToCents(value: string) {
  const text = String(value || "").trim();
  if (!text) return null;
  const normalized = text.replace(/[$,]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed * 100));
}

function nullableText(value: string) {
  const text = String(value || "").trim();
  return text ? text : null;
}
