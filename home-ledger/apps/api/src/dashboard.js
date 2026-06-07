const ACTIVITY_LIMIT = 10;

export async function getDashboardSummary({ db, workspaceId }) {
  const result = await db.query(
    `
      -- getDashboardSummary
      WITH active_properties AS (
        SELECT *
        FROM properties
        WHERE workspace_id = $1
          AND deleted_at IS NULL
      ),
      active_projects AS (
        SELECT *
        FROM projects
        WHERE workspace_id = $1
          AND deleted_at IS NULL
      ),
      open_projects AS (
        SELECT *
        FROM active_projects
        WHERE archived_at IS NULL
      ),
      active_vendors AS (
        SELECT *
        FROM vendors
        WHERE workspace_id = $1
          AND deleted_at IS NULL
      ),
      open_vendors AS (
        SELECT *
        FROM active_vendors
        WHERE archived_at IS NULL
      ),
      active_expenses AS (
        SELECT *
        FROM expenses
        WHERE workspace_id = $1
          AND deleted_at IS NULL
      ),
      active_documents AS (
        SELECT *
        FROM documents
        WHERE workspace_id = $1
          AND deleted_at IS NULL
      ),
      document_file_state AS (
        SELECT
          d.id AS document_id,
          EXISTS (
            SELECT 1
            FROM document_files df
            WHERE df.workspace_id = d.workspace_id
              AND df.document_id = d.id
              AND df.deleted_at IS NULL
              AND df.status = 'available'
          ) AS has_available_file,
          EXISTS (
            SELECT 1
            FROM document_ocr o
            JOIN document_files df
              ON df.workspace_id = o.workspace_id
             AND df.id = o.document_file_id
             AND df.document_id = o.document_id
             AND df.deleted_at IS NULL
             AND df.status = 'available'
            WHERE o.workspace_id = d.workspace_id
              AND o.document_id = d.id
              AND o.status = 'succeeded'
              AND o.text IS NOT NULL
              AND length(o.text) > 0
          ) AS has_ocr_text,
          EXISTS (
            SELECT 1
            FROM document_ocr o
            WHERE o.workspace_id = d.workspace_id
              AND o.document_id = d.id
              AND o.status IN ('queued', 'processing')
          ) AS has_pending_ocr
        FROM active_documents d
      ),
      project_status_summary AS (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'status', status,
            'count', record_count
          )
          ORDER BY status
        ), '[]'::jsonb) AS value
        FROM (
          SELECT status, count(*)::int AS record_count
          FROM active_projects
          GROUP BY status
        ) rows
      ),
      expense_classification_summary AS (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'record_treatment', record_treatment,
            'count', record_count,
            'total_amount_cents', total_amount_cents
          )
          ORDER BY record_treatment
        ), '[]'::jsonb) AS value
        FROM (
          SELECT
            record_treatment,
            count(*)::int AS record_count,
            coalesce(sum(amount_cents), 0)::bigint AS total_amount_cents
          FROM active_expenses
          GROUP BY record_treatment
        ) rows
      ),
      document_type_summary AS (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'document_type', document_type,
            'count', record_count
          )
          ORDER BY document_type
        ), '[]'::jsonb) AS value
        FROM (
          SELECT document_type, count(*)::int AS record_count
          FROM active_documents
          GROUP BY document_type
        ) rows
      ),
      follow_up_summary AS (
        SELECT coalesce(jsonb_agg(item ORDER BY sort_order), '[]'::jsonb) AS value
        FROM (
          SELECT
            1 AS sort_order,
            jsonb_build_object(
              'type', 'expense_support',
              'label', 'Expense support',
              'count', count(*)::int
            ) AS item
          FROM active_expenses
          WHERE documentation_status IN ('no_document_yet', 'needs_follow_up')
          HAVING count(*) > 0
          UNION ALL
          SELECT
            2 AS sort_order,
            jsonb_build_object(
              'type', 'missing_file',
              'label', 'Documents missing files',
              'count', count(*)::int
            ) AS item
          FROM active_documents d
          JOIN document_file_state dfs
            ON dfs.document_id = d.id
          WHERE NOT dfs.has_available_file
          HAVING count(*) > 0
          UNION ALL
          SELECT
            3 AS sort_order,
            jsonb_build_object(
              'type', 'needs_review',
              'label', 'Projects needing review',
              'count', count(*)::int
            ) AS item
          FROM open_projects
          WHERE status = 'blocked'
             OR (status = 'completed' AND completion_date IS NULL)
          HAVING count(*) > 0
        ) rows
      ),
      recent_activity_summary AS (
        SELECT coalesce(jsonb_agg(activity ORDER BY occurred_at DESC, record_id ASC), '[]'::jsonb) AS value
        FROM (
          SELECT *
          FROM (
            SELECT
              p.created_at AS occurred_at,
              p.id AS record_id,
              jsonb_build_object(
                'activity_type', 'property',
                'record_type', 'property',
                'record_id', p.id,
                'record_name', p.name,
                'summary', p.name,
                'occurred_at', p.created_at,
                'property_id', p.id,
                'property_name', p.name
              ) AS activity
            FROM active_properties p
            WHERE p.archived_at IS NULL
            UNION ALL
            SELECT
              pr.created_at AS occurred_at,
              pr.id AS record_id,
              jsonb_build_object(
                'activity_type', 'project',
                'record_type', 'project',
                'record_id', pr.id,
                'record_name', pr.name,
                'summary', pr.name,
                'occurred_at', pr.created_at,
                'property_id', p.id,
                'property_name', p.name,
                'project_id', pr.id,
                'project_name', pr.name,
                'status', pr.status
              ) AS activity
            FROM open_projects pr
            JOIN properties p
              ON p.workspace_id = pr.workspace_id
             AND p.id = pr.property_id
            UNION ALL
            SELECT
              e.created_at AS occurred_at,
              e.id AS record_id,
              jsonb_build_object(
                'activity_type', 'expense',
                'record_type', 'expense',
                'record_id', e.id,
                'record_name', e.description,
                'summary', e.description,
                'occurred_at', e.created_at,
                'property_id', p.id,
                'property_name', p.name,
                'project_id', pr.id,
                'project_name', pr.name,
                'expense_id', e.id,
                'amount_cents', e.amount_cents,
                'record_treatment', e.record_treatment
              ) AS activity
            FROM active_expenses e
            JOIN properties p
              ON p.workspace_id = e.workspace_id
             AND p.id = e.property_id
            LEFT JOIN projects pr
              ON pr.workspace_id = e.workspace_id
             AND pr.id = e.project_id
            UNION ALL
            SELECT
              d.created_at AS occurred_at,
              d.id AS record_id,
              jsonb_build_object(
                'activity_type', 'document',
                'record_type', 'document',
                'record_id', d.id,
                'record_name', d.display_name,
                'summary', d.display_name,
                'occurred_at', d.created_at,
                'property_id', p.id,
                'property_name', p.name,
                'project_id', pr.id,
                'project_name', pr.name,
                'document_id', d.id,
                'document_type', d.document_type,
                'file_availability', d.file_availability
              ) AS activity
            FROM active_documents d
            JOIN properties p
              ON p.workspace_id = d.workspace_id
             AND p.id = d.property_id
            LEFT JOIN projects pr
              ON pr.workspace_id = d.workspace_id
             AND pr.id = d.project_id
          ) activity_rows
          ORDER BY occurred_at DESC, record_id ASC
          LIMIT ${ACTIVITY_LIMIT}
        ) limited
      )
      SELECT
        (SELECT count(*)::int FROM active_properties) AS property_count,
        (SELECT count(*)::int FROM active_properties WHERE archived_at IS NULL) AS active_property_count,
        (SELECT count(*)::int FROM active_properties WHERE archived_at IS NOT NULL) AS archived_property_count,
        (SELECT count(*)::int FROM active_projects) AS project_count,
        (SELECT count(*)::int FROM active_projects WHERE archived_at IS NULL) AS active_project_count,
        (SELECT count(*)::int FROM active_projects WHERE archived_at IS NOT NULL) AS archived_project_count,
        (SELECT count(*)::int FROM active_expenses) AS expense_count,
        (SELECT coalesce(sum(amount_cents), 0)::bigint FROM active_expenses) AS total_amount_cents,
        (SELECT count(*)::int FROM active_expenses WHERE record_treatment = 'review_later') AS review_later_count,
        (SELECT coalesce(sum(amount_cents), 0)::bigint FROM active_expenses WHERE record_treatment = 'possible_improvement') AS possible_improvement_total_cents,
        (SELECT coalesce(sum(amount_cents), 0)::bigint FROM active_expenses WHERE record_treatment = 'repair_upkeep') AS repair_upkeep_total_cents,
        (SELECT count(*)::int FROM active_documents) AS document_count,
        (SELECT count(*)::int FROM document_file_state WHERE has_available_file) AS with_file_count,
        (SELECT count(*)::int FROM document_file_state WHERE NOT has_available_file) AS missing_file_count,
        (SELECT count(*)::int FROM document_file_state WHERE has_ocr_text) AS ocr_text_available_count,
        (SELECT count(*)::int FROM document_file_state WHERE has_pending_ocr) AS ocr_pending_count,
        (SELECT count(*)::int FROM open_vendors) AS vendor_count,
        (SELECT value FROM project_status_summary) AS projects_by_status,
        (SELECT value FROM expense_classification_summary) AS expenses_by_classification,
        (SELECT value FROM document_type_summary) AS documents_by_type,
        (SELECT value FROM recent_activity_summary) AS recent_activity,
        (SELECT value FROM follow_up_summary) AS follow_ups
    `,
    [workspaceId]
  );

  return mapDashboardRow(workspaceId, result.rows[0] || {});
}

export function serializeDashboardSummary(summary) {
  return {
    workspace_id: summary.workspaceId,
    generated_at: summary.generatedAt,
    properties: summary.properties,
    projects: summary.projects,
    expenses: summary.expenses,
    documents: summary.documents,
    vendors: summary.vendors,
    recent_activity: summary.recentActivity,
    follow_ups: summary.followUps
  };
}

function mapDashboardRow(workspaceId, row) {
  const followUps = parseJsonArray(row.follow_ups);
  const openFollowUpCount = followUps.reduce((total, item) => total + toNumber(item.count), 0);

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    properties: {
      count: toNumber(row.property_count),
      active_count: toNumber(row.active_property_count),
      archived_count: toNumber(row.archived_property_count)
    },
    projects: {
      count: toNumber(row.project_count),
      active_count: toNumber(row.active_project_count),
      archived_count: toNumber(row.archived_project_count),
      by_status: parseJsonArray(row.projects_by_status).map((item) => ({
        status: item.status,
        count: toNumber(item.count)
      })),
      open_follow_up_count: openFollowUpCount
    },
    expenses: {
      count: toNumber(row.expense_count),
      total_amount_cents: toNumber(row.total_amount_cents),
      by_classification: parseJsonArray(row.expenses_by_classification).map((item) => ({
        record_treatment: item.record_treatment,
        count: toNumber(item.count),
        total_amount_cents: toNumber(item.total_amount_cents)
      })),
      review_later_count: toNumber(row.review_later_count),
      possible_improvement_total_cents: toNumber(row.possible_improvement_total_cents),
      repair_upkeep_total_cents: toNumber(row.repair_upkeep_total_cents)
    },
    documents: {
      count: toNumber(row.document_count),
      with_file_count: toNumber(row.with_file_count),
      missing_file_count: toNumber(row.missing_file_count),
      ocr_text_available_count: toNumber(row.ocr_text_available_count),
      ocr_pending_count: toNumber(row.ocr_pending_count),
      by_type: parseJsonArray(row.documents_by_type).map((item) => ({
        document_type: item.document_type,
        count: toNumber(item.count)
      }))
    },
    vendors: {
      count: toNumber(row.vendor_count)
    },
    recentActivity: parseJsonArray(row.recent_activity).map(sanitizeActivity),
    followUps: followUps
      .map((item) => ({
        type: item.type,
        label: item.label,
        count: toNumber(item.count)
      }))
      .filter((item) => item.count > 0)
  };
}

function sanitizeActivity(activity) {
  return {
    activity_type: activity.activity_type,
    record_type: activity.record_type,
    record_id: activity.record_id,
    record_name: activity.record_name,
    summary: activity.summary,
    occurred_at: formatTimestamp(activity.occurred_at),
    property_id: activity.property_id || null,
    property_name: activity.property_name || null,
    project_id: activity.project_id || null,
    project_name: activity.project_name || null,
    expense_id: activity.expense_id || null,
    document_id: activity.document_id || null,
    amount_cents: activity.amount_cents === undefined ? null : toNumber(activity.amount_cents),
    document_type: activity.document_type || null,
    file_availability: activity.file_availability || null,
    record_treatment: activity.record_treatment || null,
    status: activity.status || null
  };
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return Number(value);
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
