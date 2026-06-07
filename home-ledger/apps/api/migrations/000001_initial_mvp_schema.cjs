exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      display_name text,
      status text NOT NULL DEFAULT 'active',
      timezone text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT users_email_not_blank_check CHECK (length(trim(email)) > 0),
      CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled', 'pending_deletion', 'deleted'))
    );

    CREATE UNIQUE INDEX users_email_active_uidx
      ON users (lower(email))
      WHERE deleted_at IS NULL;
    CREATE INDEX users_status_idx ON users (status);

    CREATE TABLE workspaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      owner_user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'active',
      settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT workspaces_owner_user_id_fk
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT workspaces_name_not_blank_check CHECK (length(trim(name)) > 0),
      CONSTRAINT workspaces_status_check CHECK (status IN ('active', 'suspended', 'pending_deletion', 'deleted'))
    );

    CREATE INDEX workspaces_owner_user_id_idx ON workspaces (owner_user_id);
    CREATE INDEX workspaces_status_idx ON workspaces (status);

    CREATE TABLE workspace_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      removed_at timestamptz,
      CONSTRAINT workspace_memberships_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT workspace_memberships_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT workspace_memberships_role_check CHECK (role IN ('owner', 'editor', 'viewer')),
      CONSTRAINT workspace_memberships_status_check CHECK (status IN ('active', 'invited', 'disabled', 'removed'))
    );

    CREATE UNIQUE INDEX workspace_memberships_active_uidx
      ON workspace_memberships (workspace_id, user_id)
      WHERE removed_at IS NULL;
    CREATE INDEX workspace_memberships_user_status_idx ON workspace_memberships (user_id, status);
    CREATE INDEX workspace_memberships_workspace_role_idx ON workspace_memberships (workspace_id, role);

    CREATE TABLE properties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      name text NOT NULL,
      display_address text,
      purchase_date date,
      purchase_price_cents bigint,
      currency_code char(3) NOT NULL DEFAULT 'USD',
      notes text,
      is_primary boolean NOT NULL DEFAULT false,
      archived_at timestamptz,
      deleted_at timestamptz,
      created_by_user_id uuid,
      updated_by_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT properties_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT properties_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT properties_updated_by_fk
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT properties_name_not_blank_check CHECK (length(trim(name)) > 0),
      CONSTRAINT properties_purchase_price_cents_check
        CHECK (purchase_price_cents IS NULL OR purchase_price_cents >= 0),
      CONSTRAINT properties_currency_code_check CHECK (currency_code ~ '^[A-Z]{3}$')
    );

    CREATE UNIQUE INDEX properties_one_primary_uidx
      ON properties (workspace_id)
      WHERE is_primary = true AND deleted_at IS NULL;
    CREATE INDEX properties_workspace_name_idx ON properties (workspace_id, deleted_at, name);
    CREATE INDEX properties_workspace_archived_idx ON properties (workspace_id, archived_at);

    CREATE TABLE vendors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      name text NOT NULL,
      normalized_name text,
      category text,
      contact_name text,
      phone text,
      email text,
      website text,
      notes text,
      status text NOT NULL DEFAULT 'active',
      source_confidence text,
      archived_at timestamptz,
      deleted_at timestamptz,
      created_by_user_id uuid,
      updated_by_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT vendors_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT vendors_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT vendors_updated_by_fk
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT vendors_name_not_blank_check CHECK (length(trim(name)) > 0),
      CONSTRAINT vendors_status_check CHECK (status IN ('active', 'archived')),
      CONSTRAINT vendors_source_confidence_check
        CHECK (source_confidence IS NULL OR source_confidence IN ('explicit', 'inferred', 'user_confirmed'))
    );

    CREATE INDEX vendors_workspace_name_idx ON vendors (workspace_id, deleted_at, name);
    CREATE INDEX vendors_workspace_normalized_idx ON vendors (workspace_id, normalized_name);

    CREATE TABLE projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      property_id uuid NOT NULL,
      vendor_id uuid,
      name text NOT NULL,
      category text NOT NULL,
      status text NOT NULL DEFAULT 'planned',
      start_date date,
      completion_date date,
      contractor_name_raw text,
      permit_number text,
      scope_summary text,
      notes text,
      completeness_override_note text,
      completeness_overridden_at timestamptz,
      archived_at timestamptz,
      deleted_at timestamptz,
      created_by_user_id uuid,
      updated_by_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT projects_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT projects_property_fk
        FOREIGN KEY (workspace_id, property_id) REFERENCES properties(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT projects_vendor_fk
        FOREIGN KEY (workspace_id, vendor_id) REFERENCES vendors(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT projects_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT projects_updated_by_fk
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT projects_name_not_blank_check CHECK (length(trim(name)) > 0),
      CONSTRAINT projects_category_not_blank_check CHECK (length(trim(category)) > 0),
      CONSTRAINT projects_status_check CHECK (status IN ('planned', 'in_progress', 'blocked', 'completed', 'archived'))
    );

    CREATE INDEX projects_workspace_property_idx ON projects (workspace_id, property_id, deleted_at);
    CREATE INDEX projects_workspace_status_idx ON projects (workspace_id, status, deleted_at);
    CREATE INDEX projects_workspace_category_idx ON projects (workspace_id, category, deleted_at);
    CREATE INDEX projects_workspace_start_date_idx ON projects (workspace_id, start_date);
    CREATE INDEX projects_workspace_completion_date_idx ON projects (workspace_id, completion_date);

    CREATE TABLE expenses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      property_id uuid NOT NULL,
      project_id uuid,
      vendor_id uuid,
      vendor_name_raw text,
      expense_date date,
      description text NOT NULL,
      amount_cents bigint NOT NULL,
      currency_code char(3) NOT NULL DEFAULT 'USD',
      category text NOT NULL,
      record_treatment text NOT NULL DEFAULT 'review_later',
      legacy_classification text,
      documentation_status text NOT NULL DEFAULT 'no_document_yet',
      notes text,
      deleted_at timestamptz,
      created_by_user_id uuid,
      updated_by_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT expenses_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT expenses_property_fk
        FOREIGN KEY (workspace_id, property_id) REFERENCES properties(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT expenses_project_fk
        FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT expenses_vendor_fk
        FOREIGN KEY (workspace_id, vendor_id) REFERENCES vendors(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT expenses_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT expenses_updated_by_fk
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT expenses_description_not_blank_check CHECK (length(trim(description)) > 0),
      CONSTRAINT expenses_category_not_blank_check CHECK (length(trim(category)) > 0),
      CONSTRAINT expenses_amount_cents_check CHECK (amount_cents >= 0),
      CONSTRAINT expenses_currency_code_check CHECK (currency_code ~ '^[A-Z]{3}$'),
      CONSTRAINT expenses_record_treatment_check
        CHECK (record_treatment IN ('possible_improvement', 'repair_upkeep', 'review_later')),
      CONSTRAINT expenses_documentation_status_check
        CHECK (documentation_status IN ('receipt_attached', 'invoice_attached', 'no_document_yet', 'needs_follow_up'))
    );

    CREATE INDEX expenses_workspace_property_idx ON expenses (workspace_id, property_id, deleted_at);
    CREATE INDEX expenses_workspace_project_idx ON expenses (workspace_id, project_id, deleted_at);
    CREATE INDEX expenses_workspace_vendor_idx ON expenses (workspace_id, vendor_id, deleted_at);
    CREATE INDEX expenses_workspace_date_idx ON expenses (workspace_id, expense_date DESC);
    CREATE INDEX expenses_workspace_treatment_idx ON expenses (workspace_id, record_treatment, deleted_at);
    CREATE INDEX expenses_workspace_category_idx ON expenses (workspace_id, category, deleted_at);
    CREATE INDEX expenses_workspace_documentation_idx ON expenses (workspace_id, documentation_status, deleted_at);

    CREATE TABLE documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      property_id uuid NOT NULL,
      project_id uuid,
      expense_id uuid,
      display_name text NOT NULL,
      document_type text NOT NULL,
      document_date date,
      notes text,
      file_availability text NOT NULL DEFAULT 'not_uploaded',
      file_status_note text,
      deleted_at timestamptz,
      created_by_user_id uuid,
      updated_by_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT documents_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT documents_property_fk
        FOREIGN KEY (workspace_id, property_id) REFERENCES properties(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT documents_project_fk
        FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT documents_expense_fk
        FOREIGN KEY (workspace_id, expense_id) REFERENCES expenses(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT documents_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT documents_updated_by_fk
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT documents_display_name_not_blank_check CHECK (length(trim(display_name)) > 0),
      CONSTRAINT documents_type_not_blank_check CHECK (length(trim(document_type)) > 0),
      CONSTRAINT documents_file_availability_check CHECK (
        file_availability IN (
          'available',
          'missing',
          'not_uploaded',
          'removed',
          'blocked',
          'skipped',
          'tutorial_metadata',
          'corrupt',
          'checksum_failed'
        )
      )
    );

    CREATE INDEX documents_workspace_property_idx ON documents (workspace_id, property_id, deleted_at);
    CREATE INDEX documents_workspace_project_idx ON documents (workspace_id, project_id, deleted_at);
    CREATE INDEX documents_workspace_expense_idx ON documents (workspace_id, expense_id, deleted_at);
    CREATE INDEX documents_workspace_type_idx ON documents (workspace_id, document_type, deleted_at);
    CREATE INDEX documents_workspace_file_availability_idx ON documents (workspace_id, file_availability, deleted_at);
    CREATE INDEX documents_workspace_date_idx ON documents (workspace_id, document_date DESC);

    CREATE TABLE document_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      document_id uuid NOT NULL,
      storage_provider text NOT NULL,
      storage_key text NOT NULL,
      original_file_name text NOT NULL,
      mime_type text NOT NULL,
      size_bytes bigint NOT NULL,
      sha256 text,
      source text NOT NULL DEFAULT 'web_upload',
      status text NOT NULL DEFAULT 'pending_upload',
      uploaded_by_user_id uuid,
      uploaded_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT document_files_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT document_files_document_fk
        FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE,
      CONSTRAINT document_files_uploaded_by_fk
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT document_files_storage_provider_not_blank_check CHECK (length(trim(storage_provider)) > 0),
      CONSTRAINT document_files_storage_key_not_blank_check CHECK (length(trim(storage_key)) > 0),
      CONSTRAINT document_files_original_name_not_blank_check CHECK (length(trim(original_file_name)) > 0),
      CONSTRAINT document_files_mime_type_not_blank_check CHECK (length(trim(mime_type)) > 0),
      CONSTRAINT document_files_size_bytes_check CHECK (size_bytes >= 0),
      CONSTRAINT document_files_sha256_check CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
      CONSTRAINT document_files_source_check
        CHECK (source IN ('web_upload', 'ios_upload', 'legacy_import', 'generated_export')),
      CONSTRAINT document_files_status_check
        CHECK (status IN ('available', 'pending_upload', 'blocked', 'quarantined', 'deleted', 'failed'))
    );

    CREATE UNIQUE INDEX document_files_one_active_uidx
      ON document_files (document_id)
      WHERE deleted_at IS NULL AND status = 'available';
    CREATE INDEX document_files_workspace_document_idx ON document_files (workspace_id, document_id);
    CREATE INDEX document_files_workspace_status_idx ON document_files (workspace_id, status);
    CREATE INDEX document_files_workspace_sha256_idx ON document_files (workspace_id, sha256);

    CREATE TABLE document_ocr (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      document_id uuid NOT NULL,
      document_file_id uuid,
      status text NOT NULL DEFAULT 'not_requested',
      text text,
      text_sha256 text,
      engine text,
      error_code text,
      error_message text,
      started_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT document_ocr_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT document_ocr_document_fk
        FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE CASCADE,
      CONSTRAINT document_ocr_file_fk
        FOREIGN KEY (workspace_id, document_file_id) REFERENCES document_files(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT document_ocr_status_check
        CHECK (status IN ('not_requested', 'queued', 'processing', 'succeeded', 'failed', 'skipped')),
      CONSTRAINT document_ocr_text_sha256_check CHECK (text_sha256 IS NULL OR text_sha256 ~ '^[a-f0-9]{64}$')
    );

    CREATE UNIQUE INDEX document_ocr_document_uidx ON document_ocr (document_id);
    CREATE INDEX document_ocr_workspace_status_idx ON document_ocr (workspace_id, status);

    CREATE TABLE follow_up_overrides (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      follow_up_type text NOT NULL,
      source_follow_up_id text,
      property_id uuid,
      project_id uuid,
      expense_id uuid,
      document_id uuid,
      label_snapshot text,
      detail_snapshot text,
      note text,
      completed_by_user_id uuid,
      completed_at timestamptz NOT NULL DEFAULT now(),
      invalidated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      legacy_source jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (workspace_id, id),
      CONSTRAINT follow_up_overrides_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT follow_up_overrides_property_fk
        FOREIGN KEY (workspace_id, property_id) REFERENCES properties(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT follow_up_overrides_project_fk
        FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT follow_up_overrides_expense_fk
        FOREIGN KEY (workspace_id, expense_id) REFERENCES expenses(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT follow_up_overrides_document_fk
        FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT follow_up_overrides_completed_by_fk
        FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT follow_up_overrides_type_not_blank_check CHECK (length(trim(follow_up_type)) > 0)
    );

    CREATE UNIQUE INDEX follow_up_overrides_active_context_uidx
      ON follow_up_overrides (
        workspace_id,
        follow_up_type,
        coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(expense_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(document_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE invalidated_at IS NULL;
    CREATE INDEX follow_up_overrides_workspace_type_idx ON follow_up_overrides (workspace_id, follow_up_type);
    CREATE INDEX follow_up_overrides_workspace_project_idx ON follow_up_overrides (workspace_id, project_id);
    CREATE INDEX follow_up_overrides_workspace_expense_idx ON follow_up_overrides (workspace_id, expense_id);
    CREATE INDEX follow_up_overrides_workspace_document_idx ON follow_up_overrides (workspace_id, document_id);

    CREATE TABLE activity_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      actor_user_id uuid,
      event_type text NOT NULL,
      record_type text NOT NULL,
      record_id uuid,
      property_id uuid,
      project_id uuid,
      expense_id uuid,
      document_id uuid,
      summary text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT activity_events_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT activity_events_actor_user_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT activity_events_property_fk
        FOREIGN KEY (workspace_id, property_id) REFERENCES properties(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT activity_events_project_fk
        FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT activity_events_expense_fk
        FOREIGN KEY (workspace_id, expense_id) REFERENCES expenses(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT activity_events_document_fk
        FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT activity_events_summary_not_blank_check CHECK (length(trim(summary)) > 0),
      CONSTRAINT activity_events_type_check CHECK (
        event_type IN (
          'created',
          'updated',
          'deleted',
          'uploaded_file',
          'removed_file',
          'ocr_completed',
          'imported',
          'exported',
          'follow_up_overridden'
        )
      ),
      CONSTRAINT activity_events_record_type_check
        CHECK (record_type IN ('property', 'vendor', 'project', 'expense', 'document', 'file', 'export', 'import', 'workspace'))
    );

    CREATE INDEX activity_events_workspace_occurred_idx ON activity_events (workspace_id, occurred_at DESC);
    CREATE INDEX activity_events_workspace_record_type_idx ON activity_events (workspace_id, record_type, occurred_at DESC);
    CREATE INDEX activity_events_workspace_property_idx ON activity_events (workspace_id, property_id, occurred_at DESC);
    CREATE INDEX activity_events_workspace_project_idx ON activity_events (workspace_id, project_id, occurred_at DESC);

    CREATE TABLE exports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      created_by_user_id uuid,
      export_type text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      file_id uuid,
      storage_provider text,
      storage_key text,
      file_name text,
      mime_type text,
      size_bytes bigint,
      parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
      record_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      deleted_at timestamptz,
      CONSTRAINT exports_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT exports_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT exports_file_fk
        FOREIGN KEY (workspace_id, file_id) REFERENCES document_files(workspace_id, id) ON DELETE RESTRICT,
      CONSTRAINT exports_size_bytes_check CHECK (size_bytes IS NULL OR size_bytes >= 0),
      CONSTRAINT exports_type_check
        CHECK (export_type IN ('review_packet_pdf', 'expenses_csv', 'full_backup', 'document_archive')),
      CONSTRAINT exports_status_check CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'expired', 'deleted'))
    );

    CREATE INDEX exports_workspace_created_idx ON exports (workspace_id, created_at DESC);
    CREATE INDEX exports_workspace_type_status_idx ON exports (workspace_id, export_type, status);
    CREATE INDEX exports_workspace_expires_idx ON exports (workspace_id, expires_at);

    CREATE TABLE workspace_entitlements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      key text NOT NULL,
      value jsonb NOT NULL DEFAULT '{}'::jsonb,
      source text NOT NULL DEFAULT 'system_default',
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT workspace_entitlements_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT workspace_entitlements_key_not_blank_check CHECK (length(trim(key)) > 0),
      CONSTRAINT workspace_entitlements_source_check
        CHECK (source IN ('subscription', 'manual', 'trial', 'system_default'))
    );

    CREATE UNIQUE INDEX workspace_entitlements_active_key_uidx
      ON workspace_entitlements (workspace_id, key)
      WHERE expires_at IS NULL;
    CREATE INDEX workspace_entitlements_workspace_key_idx ON workspace_entitlements (workspace_id, key);

    CREATE TABLE audit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      actor_user_id uuid,
      actor_type text NOT NULL,
      action text NOT NULL,
      record_type text,
      record_id uuid,
      ip_address inet,
      user_agent text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT audit_events_workspace_id_fk
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
      CONSTRAINT audit_events_actor_user_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user', 'support', 'system', 'admin')),
      CONSTRAINT audit_events_action_not_blank_check CHECK (length(trim(action)) > 0)
    );

    CREATE INDEX audit_events_workspace_occurred_idx ON audit_events (workspace_id, occurred_at DESC);
    CREATE INDEX audit_events_actor_occurred_idx ON audit_events (actor_user_id, occurred_at DESC);
    CREATE INDEX audit_events_workspace_action_idx ON audit_events (workspace_id, action, occurred_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_events;
    DROP TABLE IF EXISTS workspace_entitlements;
    DROP TABLE IF EXISTS exports;
    DROP TABLE IF EXISTS activity_events;
    DROP TABLE IF EXISTS follow_up_overrides;
    DROP TABLE IF EXISTS document_ocr;
    DROP TABLE IF EXISTS document_files;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS vendors;
    DROP TABLE IF EXISTS properties;
    DROP TABLE IF EXISTS workspace_memberships;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS users;
  `);
};
