const EXPORT_PRODUCT_NAME = "Home Ledger";

export const EXPENSE_CSV_HEADERS = [
  "Export Source",
  "Export Date",
  "Property",
  "Project",
  "Vendor ID",
  "Category",
  "Date",
  "Vendor or payee",
  "Description",
  "Amount",
  "Amount cents",
  "Cost type",
  "Documentation",
  "Notes",
  "Expense ID",
  "Property ID",
  "Project ID",
  "Document count",
  "Created at",
  "Updated at"
];

export const DOCUMENT_CSV_HEADERS = [
  "document_id",
  "title",
  "document_type",
  "property_id",
  "property_name",
  "project_id",
  "project_name",
  "expense_id",
  "expense_description",
  "file_available",
  "file_mime_type",
  "file_size_bytes",
  "ocr_status",
  "text_available",
  "notes",
  "created_at",
  "updated_at"
];

const CLASSIFICATION_LABELS = {
  possible_improvement: "Possible improvement",
  repair_upkeep: "Repair or upkeep",
  review_later: "Review later"
};

export async function getExportData({ db, workspaceId }) {
  const properties = await db.query(
    `
      -- listExportProperties
      SELECT
        id,
        name,
        display_address,
        purchase_date,
        purchase_price_cents,
        currency_code,
        notes,
        is_primary,
        archived_at,
        created_at,
        updated_at
      FROM properties
      WHERE workspace_id = $1
        AND deleted_at IS NULL
      ORDER BY name ASC, id ASC
    `,
    [workspaceId]
  );
  const projects = await db.query(
    `
      -- listExportProjects
      SELECT
        pr.id,
        pr.property_id,
        p.name AS property_name,
        pr.vendor_id,
        v.name AS vendor_name,
        pr.name,
        pr.category,
        pr.status,
        pr.start_date,
        pr.completion_date,
        pr.contractor_name_raw,
        pr.permit_number,
        pr.scope_summary,
        pr.notes,
        pr.completeness_override_note,
        pr.completeness_overridden_at,
        pr.archived_at,
        pr.created_at,
        pr.updated_at
      FROM projects pr
      JOIN properties p
        ON p.workspace_id = pr.workspace_id
       AND p.id = pr.property_id
      LEFT JOIN vendors v
        ON v.workspace_id = pr.workspace_id
       AND v.id = pr.vendor_id
      WHERE pr.workspace_id = $1
        AND pr.deleted_at IS NULL
      ORDER BY pr.name ASC, pr.id ASC
    `,
    [workspaceId]
  );
  const vendors = await db.query(
    `
      -- listExportVendors
      SELECT
        id,
        name,
        normalized_name,
        category,
        contact_name,
        phone,
        email,
        website,
        notes,
        status,
        archived_at,
        created_at,
        updated_at
      FROM vendors
      WHERE workspace_id = $1
        AND deleted_at IS NULL
      ORDER BY name ASC, id ASC
    `,
    [workspaceId]
  );
  const expenses = await db.query(
    `
      -- listExportExpenses
      SELECT
        e.id,
        e.property_id,
        p.name AS property_name,
        e.project_id,
        pr.name AS project_name,
        e.vendor_id,
        v.name AS vendor_name,
        e.vendor_name_raw,
        e.expense_date,
        e.description,
        e.amount_cents,
        e.currency_code,
        e.category,
        e.record_treatment,
        e.documentation_status,
        e.notes,
        e.created_at,
        e.updated_at,
        count(d.id)::int AS document_count
      FROM expenses e
      JOIN properties p
        ON p.workspace_id = e.workspace_id
       AND p.id = e.property_id
      LEFT JOIN projects pr
        ON pr.workspace_id = e.workspace_id
       AND pr.id = e.project_id
      LEFT JOIN vendors v
        ON v.workspace_id = e.workspace_id
       AND v.id = e.vendor_id
      LEFT JOIN documents d
        ON d.workspace_id = e.workspace_id
       AND d.expense_id = e.id
       AND d.deleted_at IS NULL
      WHERE e.workspace_id = $1
        AND e.deleted_at IS NULL
      GROUP BY e.id, p.name, pr.name, v.name
      ORDER BY e.expense_date DESC NULLS LAST, e.created_at DESC, e.id ASC
    `,
    [workspaceId]
  );
  const documents = await db.query(
    `
      -- listExportDocuments
      SELECT
        d.id,
        d.property_id,
        p.name AS property_name,
        d.project_id,
        pr.name AS project_name,
        d.expense_id,
        e.description AS expense_description,
        d.display_name,
        d.document_type,
        d.document_date,
        d.notes,
        d.file_availability,
        d.file_status_note,
        d.created_at,
        d.updated_at,
        f.id AS file_id,
        f.original_file_name AS file_original_file_name,
        f.mime_type AS file_mime_type,
        f.size_bytes AS file_size_bytes,
        f.status AS file_status,
        o.status AS ocr_status,
        (o.text IS NOT NULL AND length(o.text) > 0 AND o.status = 'succeeded' AND o.document_file_id = f.id AND f.status = 'available') AS text_available
      FROM documents d
      JOIN properties p
        ON p.workspace_id = d.workspace_id
       AND p.id = d.property_id
      LEFT JOIN projects pr
        ON pr.workspace_id = d.workspace_id
       AND pr.id = d.project_id
      LEFT JOIN expenses e
        ON e.workspace_id = d.workspace_id
       AND e.id = d.expense_id
      LEFT JOIN LATERAL (
        SELECT df.id, df.original_file_name, df.mime_type, df.size_bytes, df.status
        FROM document_files df
        WHERE df.workspace_id = d.workspace_id
          AND df.document_id = d.id
          AND df.deleted_at IS NULL
        ORDER BY CASE WHEN df.status = 'available' THEN 0 ELSE 1 END, df.created_at DESC, df.id ASC
        LIMIT 1
      ) f ON true
      LEFT JOIN document_ocr o
        ON o.workspace_id = d.workspace_id
       AND o.document_id = d.id
      WHERE d.workspace_id = $1
        AND d.deleted_at IS NULL
      ORDER BY d.document_date DESC NULLS LAST, d.created_at DESC, d.id ASC
    `,
    [workspaceId]
  );

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    properties: properties.rows.map(mapProperty),
    projects: projects.rows.map(mapProject),
    vendors: vendors.rows.map(mapVendor),
    expenses: expenses.rows.map(mapExpense),
    documents: documents.rows.map(mapDocument)
  };
}

export function buildExportSummary(exportData) {
  const textAvailableDocumentCount = exportData.documents.filter((document) => document.text_available).length;
  return {
    workspace_id: exportData.workspaceId,
    generated_at: exportData.generatedAt,
    property_count: exportData.properties.length,
    project_count: exportData.projects.length,
    expense_count: exportData.expenses.length,
    total_expense_amount_cents: sumBy(exportData.expenses, "amount_cents"),
    document_count: exportData.documents.length,
    vendor_count: exportData.vendors.filter((vendor) => vendor.status !== "archived" && !vendor.archived_at).length,
    review_later_count: exportData.expenses.filter((expense) => expense.record_treatment === "review_later").length,
    possible_improvement_total_cents: sumBy(
      exportData.expenses.filter((expense) => expense.record_treatment === "possible_improvement"),
      "amount_cents"
    ),
    repair_upkeep_total_cents: sumBy(
      exportData.expenses.filter((expense) => expense.record_treatment === "repair_upkeep"),
      "amount_cents"
    ),
    text_available_document_count: textAvailableDocumentCount
  };
}

export function buildExpensesCsv(exportData) {
  const rows = exportData.expenses.map((expense) => [
    EXPORT_PRODUCT_NAME,
    dateOnly(exportData.generatedAt),
    expense.property_name,
    expense.project_name,
    expense.vendor_id,
    expense.category,
    expense.expense_date,
    expense.vendor_name || expense.vendor_name_raw || "Unassigned / unknown",
    expense.description,
    formatCentsAsDecimal(expense.amount_cents),
    expense.amount_cents,
    CLASSIFICATION_LABELS[expense.record_treatment] || expense.record_treatment,
    expense.documentation_status,
    expense.notes,
    expense.id,
    expense.property_id,
    expense.project_id,
    expense.document_count,
    expense.created_at,
    expense.updated_at
  ]);
  return stringifyCsv([EXPENSE_CSV_HEADERS, ...rows]);
}

export function buildDocumentsCsv(exportData) {
  const rows = exportData.documents.map((document) => [
    document.id,
    document.title,
    document.document_type,
    document.property_id,
    document.property_name,
    document.project_id,
    document.project_name,
    document.expense_id,
    document.expense_description,
    document.file_available ? "true" : "false",
    document.file_mime_type,
    document.file_size_bytes,
    document.ocr_status,
    document.text_available ? "true" : "false",
    document.notes,
    document.created_at,
    document.updated_at
  ]);
  return stringifyCsv([DOCUMENT_CSV_HEADERS, ...rows]);
}

export function buildFullJsonExport(exportData) {
  return {
    workspace_id: exportData.workspaceId,
    generated_at: exportData.generatedAt,
    properties: exportData.properties,
    projects: exportData.projects,
    vendors: exportData.vendors,
    expenses: exportData.expenses,
    documents: exportData.documents.map((document) => ({
      id: document.id,
      title: document.title,
      document_type: document.document_type,
      document_date: document.document_date,
      property_id: document.property_id,
      property_name: document.property_name,
      project_id: document.project_id,
      project_name: document.project_name,
      expense_id: document.expense_id,
      expense_description: document.expense_description,
      notes: document.notes,
      file_availability: document.file_availability,
      file_status_note: document.file_status_note,
      file: document.file_available
        ? {
            id: document.file_id,
            original_file_name: document.file_original_file_name,
            mime_type: document.file_mime_type,
            size_bytes: document.file_size_bytes,
            status: document.file_status
          }
        : null,
      ocr: {
        status: document.ocr_status,
        text_available: document.text_available
      },
      created_at: document.created_at,
      updated_at: document.updated_at
    }))
  };
}

export function setCsvResponseHeaders(reply, filename) {
  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename="${filename}"`);
}

export function setJsonExportHeaders(reply, filename) {
  reply.header("Content-Type", "application/json; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename="${filename}"`);
}

export function exportFilename(name, extension) {
  return `home-ledger-${name}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function stringifyCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = neutralizeSpreadsheetFormula(String(value ?? ""));
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function neutralizeSpreadsheetFormula(value) {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function formatCentsAsDecimal(value) {
  const cents = Number(value || 0);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function sumBy(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function mapProperty(row) {
  return {
    id: row.id,
    name: row.name,
    display_address: row.display_address || null,
    purchase_date: formatDateOnly(row.purchase_date),
    purchase_price_cents: nullableNumber(row.purchase_price_cents),
    currency_code: row.currency_code,
    notes: row.notes || null,
    is_primary: Boolean(row.is_primary),
    archived_at: formatTimestamp(row.archived_at),
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at)
  };
}

function mapProject(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    property_name: row.property_name || null,
    vendor_id: row.vendor_id || null,
    vendor_name: row.vendor_name || null,
    name: row.name,
    category: row.category,
    status: row.status,
    start_date: formatDateOnly(row.start_date),
    completion_date: formatDateOnly(row.completion_date),
    contractor_name_raw: row.contractor_name_raw || null,
    permit_number: row.permit_number || null,
    scope_summary: row.scope_summary || null,
    notes: row.notes || null,
    completeness_override_note: row.completeness_override_note || null,
    completeness_overridden_at: formatTimestamp(row.completeness_overridden_at),
    archived_at: formatTimestamp(row.archived_at),
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at)
  };
}

function mapVendor(row) {
  return {
    id: row.id,
    name: row.name,
    normalized_name: row.normalized_name,
    category: row.category || null,
    contact_name: row.contact_name || null,
    phone: row.phone || null,
    email: row.email || null,
    website: row.website || null,
    notes: row.notes || null,
    status: row.status,
    archived_at: formatTimestamp(row.archived_at),
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at)
  };
}

function mapExpense(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    property_name: row.property_name || null,
    project_id: row.project_id || null,
    project_name: row.project_name || null,
    vendor_id: row.vendor_id || null,
    vendor_name: row.vendor_name || null,
    vendor_name_raw: row.vendor_name_raw || null,
    expense_date: formatDateOnly(row.expense_date),
    description: row.description,
    amount_cents: Number(row.amount_cents || 0),
    currency_code: row.currency_code,
    category: row.category,
    record_treatment: row.record_treatment,
    documentation_status: row.documentation_status,
    notes: row.notes || null,
    document_count: Number(row.document_count || 0),
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at)
  };
}

function mapDocument(row) {
  const fileAvailable = row.file_status === "available";
  return {
    id: row.id,
    title: row.display_name,
    document_type: row.document_type,
    document_date: formatDateOnly(row.document_date),
    property_id: row.property_id,
    property_name: row.property_name || null,
    project_id: row.project_id || null,
    project_name: row.project_name || null,
    expense_id: row.expense_id || null,
    expense_description: row.expense_description || null,
    notes: row.notes || null,
    file_availability: row.file_availability,
    file_status_note: row.file_status_note || null,
    file_available: fileAvailable,
    file_id: fileAvailable ? row.file_id : null,
    file_original_file_name: fileAvailable ? row.file_original_file_name : null,
    file_mime_type: fileAvailable ? row.file_mime_type : null,
    file_size_bytes: fileAvailable ? Number(row.file_size_bytes || 0) : null,
    file_status: fileAvailable ? row.file_status : null,
    ocr_status: row.ocr_status || "not_requested",
    text_available: Boolean(row.text_available),
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at)
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(value);
}

function formatDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
