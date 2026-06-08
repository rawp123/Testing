import type { VendorInput, VendorRecord } from "../api/types";

export interface VendorFormValues {
  name: string;
  category: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
}

export interface VendorRow {
  id: string;
  name: string;
  category: string;
  contact: string;
  phone: string;
  email: string;
  website: string;
  status: string;
  source: VendorRecord;
}

export interface VendorSelectOption {
  value: string;
  label: string;
}

export function toVendorRows(vendors: VendorRecord[]): VendorRow[] {
  return vendors
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name || "Unnamed vendor",
      category: categoryLabel(vendor.category),
      contact: vendor.contact_name || "No contact",
      phone: vendor.phone || "No phone",
      email: vendor.email || "No email",
      website: websiteLabel(vendor.website),
      status: vendor.archived_at || vendor.status === "archived" ? "Archived" : "Active",
      source: vendor
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function vendorToFormValues(vendor?: VendorRecord | null): VendorFormValues {
  return {
    name: vendor?.name || "",
    category: vendor?.category || "",
    contactName: vendor?.contact_name || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    website: vendor?.website || "",
    notes: vendor?.notes || ""
  };
}

export function formValuesToVendorInput(values: VendorFormValues): VendorInput {
  return {
    name: values.name.trim(),
    category: nullableText(values.category),
    contact_name: nullableText(values.contactName),
    phone: nullableText(values.phone),
    email: nullableText(values.email)?.toLowerCase() || null,
    website: nullableText(values.website),
    notes: nullableText(values.notes),
    status: "active"
  };
}

export function buildVendorFilterOptions(rows: VendorRow[]) {
  const options = [{ value: "all", label: "All", count: rows.length }];
  const withContact = rows.filter((row) =>
    row.source.contact_name || row.source.phone || row.source.email || row.source.website
  ).length;
  if (withContact) {
    options.push({ value: "with_contact", label: "With contact", count: withContact });
  }

  const categories = new Map<string, number>();
  for (const row of rows) {
    const category = row.source.category || "uncategorized";
    categories.set(category, (categories.get(category) || 0) + 1);
  }

  for (const [category, count] of [...categories.entries()].sort((left, right) =>
    categoryLabel(left[0]).localeCompare(categoryLabel(right[0])) || left[0].localeCompare(right[0])
  )) {
    if (category !== "uncategorized") {
      options.push({ value: `category:${category}`, label: categoryLabel(category), count });
    }
  }

  return options;
}

export function filterVendorRows(rows: VendorRow[], filter: string) {
  if (filter === "with_contact") {
    return rows.filter((row) =>
      row.source.contact_name || row.source.phone || row.source.email || row.source.website
    );
  }
  if (filter.startsWith("category:")) {
    const category = filter.slice("category:".length);
    return rows.filter((row) => row.source.category === category);
  }
  return rows;
}

export function vendorOptionsFromRecords(vendors: VendorRecord[]): VendorSelectOption[] {
  return vendors
    .map((vendor) => ({
      value: vendor.id,
      label: vendor.name || "Unnamed vendor"
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
}

function categoryLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "No category";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "No category";
}

function websiteLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "No website";
  return text.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function nullableText(value: string) {
  const text = String(value || "").trim();
  return text ? text : null;
}
