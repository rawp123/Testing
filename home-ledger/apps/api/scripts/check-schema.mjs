import pg from "pg";
import { requireTestDatabaseUrl } from "./lib/db-env.mjs";
import { runMigrations } from "./lib/migration-runner.mjs";

const databaseUrl = requireTestDatabaseUrl();

await runMigrations({ databaseUrl, direction: "up" });

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const failures = [];
  const fail = (message) => failures.push(message);
  const expect = (condition, message) => {
    if (!condition) {
      fail(message);
    }
  };

  const tables = await queryValues(
    client,
    "select table_name from information_schema.tables where table_schema = 'public'",
    "table_name"
  );

  const expectedTables = [
    "users",
    "workspaces",
    "workspace_memberships",
    "properties",
    "vendors",
    "projects",
    "expenses",
    "documents",
    "document_files",
    "document_ocr",
    "follow_up_overrides",
    "activity_events",
    "exports",
    "workspace_entitlements",
    "audit_events"
  ];

  for (const table of expectedTables) {
    expect(tables.has(table), `Missing table: ${table}`);
  }

  for (const table of ["import_batches", "import_records", "import_files"]) {
    expect(!tables.has(table), `Deferred import table should not exist yet: ${table}`);
  }

  const columns = await client.query(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
  `);
  const columnMap = new Map(
    columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row.data_type])
  );

  const workspaceScopedTables = [
    "workspace_memberships",
    "properties",
    "vendors",
    "projects",
    "expenses",
    "documents",
    "document_files",
    "document_ocr",
    "follow_up_overrides",
    "activity_events",
    "exports",
    "workspace_entitlements",
    "audit_events"
  ];

  for (const table of workspaceScopedTables) {
    expect(columnMap.has(`${table}.workspace_id`), `Missing workspace_id on ${table}`);
  }

  expect(
    columnMap.get("properties.purchase_price_cents") === "bigint",
    "properties.purchase_price_cents must be bigint"
  );
  expect(columnMap.get("expenses.amount_cents") === "bigint", "expenses.amount_cents must be bigint");

  const constraints = await client.query(`
    select conname, conrelid::regclass::text as table_name, contype, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where connamespace = 'public'::regnamespace
  `);
  const constraintDefinitions = new Map(
    constraints.rows.map((row) => [row.conname, row.definition])
  );

  const roleConstraint = constraintDefinitions.get("workspace_memberships_role_check") || "";
  expect(roleConstraint.includes("owner"), "membership role constraint must include owner");
  expect(roleConstraint.includes("editor"), "membership role constraint must include editor");
  expect(roleConstraint.includes("viewer"), "membership role constraint must include viewer");
  expect(!roleConstraint.includes("admin"), "membership role constraint must not include deferred admin role");

  const expectedForeignKeys = [
    "workspaces_owner_user_id_fk",
    "workspace_memberships_workspace_id_fk",
    "projects_property_fk",
    "projects_vendor_fk",
    "expenses_property_fk",
    "expenses_project_fk",
    "expenses_vendor_fk",
    "documents_property_fk",
    "documents_project_fk",
    "documents_expense_fk",
    "document_files_document_fk",
    "document_ocr_document_fk",
    "document_ocr_file_fk",
    "follow_up_overrides_project_fk",
    "activity_events_document_fk",
    "exports_workspace_id_fk",
    "workspace_entitlements_workspace_id_fk",
    "audit_events_workspace_id_fk"
  ];

  for (const foreignKeyName of expectedForeignKeys) {
    expect(constraintDefinitions.has(foreignKeyName), `Missing foreign key: ${foreignKeyName}`);
  }

  const indexes = await queryValues(
    client,
    "select indexname from pg_indexes where schemaname = 'public'",
    "indexname"
  );

  const expectedIndexes = [
    "users_email_active_uidx",
    "workspace_memberships_active_uidx",
    "properties_one_primary_uidx",
    "projects_workspace_status_idx",
    "expenses_workspace_date_idx",
    "documents_workspace_type_idx",
    "document_files_one_active_uidx",
    "follow_up_overrides_active_context_uidx",
    "activity_events_workspace_occurred_idx",
    "exports_workspace_created_idx",
    "workspace_entitlements_active_key_uidx",
    "audit_events_workspace_occurred_idx"
  ];

  for (const indexName of expectedIndexes) {
    expect(indexes.has(indexName), `Missing index: ${indexName}`);
  }

  if (failures.length > 0) {
    console.error("Schema check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("SaaS database schema check passed.");
} finally {
  await client.end();
}

async function queryValues(client, sql, columnName) {
  const result = await client.query(sql);
  return new Set(result.rows.map((row) => row[columnName]));
}
