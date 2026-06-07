export const WORKSPACE_IDS = {
  owner: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
  deleted: "00000000-0000-4000-8000-000000000004",
  inactiveMembership: "00000000-0000-4000-8000-000000000005"
};

export const PROPERTY_IDS = {
  ownerPrimary: "00000000-0000-4000-8000-000000000301",
  ownerSecondary: "00000000-0000-4000-8000-000000000302",
  ownerArchived: "00000000-0000-4000-8000-000000000303",
  editorPrimary: "00000000-0000-4000-8000-000000000304",
  viewerPrimary: "00000000-0000-4000-8000-000000000305"
};

export const VENDOR_IDS = {
  ownerPrimary: "00000000-0000-4000-8000-000000000501",
  ownerSecondary: "00000000-0000-4000-8000-000000000502",
  ownerArchived: "00000000-0000-4000-8000-000000000503",
  editorPrimary: "00000000-0000-4000-8000-000000000504",
  viewerPrimary: "00000000-0000-4000-8000-000000000505"
};

export const PROJECT_IDS = {
  ownerDeck: "00000000-0000-4000-8000-000000000701",
  ownerKitchen: "00000000-0000-4000-8000-000000000702",
  ownerArchived: "00000000-0000-4000-8000-000000000703",
  editorProject: "00000000-0000-4000-8000-000000000704",
  viewerProject: "00000000-0000-4000-8000-000000000705"
};

export const EXPENSE_IDS = {
  ownerDeckReceipt: "00000000-0000-4000-8000-000000000901",
  ownerKitchenInvoice: "00000000-0000-4000-8000-000000000902",
  ownerUnlinked: "00000000-0000-4000-8000-000000000903",
  ownerDeleted: "00000000-0000-4000-8000-000000000904",
  editorExpense: "00000000-0000-4000-8000-000000000905",
  viewerExpense: "00000000-0000-4000-8000-000000000906"
};

export const DOCUMENT_IDS = {
  ownerDeckReceipt: "00000000-0000-4000-8000-000000001101",
  ownerKitchenInvoice: "00000000-0000-4000-8000-000000001102",
  ownerUnlinkedPermit: "00000000-0000-4000-8000-000000001103",
  ownerDeleted: "00000000-0000-4000-8000-000000001104",
  editorDocument: "00000000-0000-4000-8000-000000001105",
  viewerDocument: "00000000-0000-4000-8000-000000001106"
};

export const DOCUMENT_FILE_IDS = {
  ownerDeckReceipt: "00000000-0000-4000-8000-000000001301",
  ownerKitchenPending: "00000000-0000-4000-8000-000000001302",
  editorDocument: "00000000-0000-4000-8000-000000001303",
  viewerDocument: "00000000-0000-4000-8000-000000001304"
};

export function createFakeWorkspaceDb(seed = {}) {
  const users = new Map();
  const workspaces = new Map();
  const memberships = new Map();
  const properties = new Map();
  const vendors = new Map();
  const projects = new Map();
  const expenses = new Map();
  const documents = new Map();
  const documentFiles = new Map();
  const documentOcr = new Map();
  const queries = [];
  let userCounter = 1;
  let workspaceCounter = 100;
  let membershipCounter = 100;
  let propertyCounter = 400;
  let vendorCounter = 600;
  let projectCounter = 800;
  let expenseCounter = 1000;
  let documentCounter = 1200;
  let documentFileCounter = 1400;
  let documentOcrCounter = 1600;

  for (const user of seed.users || []) {
    users.set(user.id, {
      status: "active",
      deleted_at: null,
      display_name: "Test User",
      ...user,
      email: user.email.toLowerCase()
    });
  }

  for (const workspace of seed.workspaces || []) {
    workspaces.set(workspace.id, {
      status: "active",
      settings: {},
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      deleted_at: null,
      ...workspace
    });
  }

  for (const membership of seed.memberships || []) {
    memberships.set(membership.id, {
      status: "active",
      removed_at: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...membership
    });
  }

  for (const property of seed.properties || []) {
    properties.set(property.id, {
      workspace_id: WORKSPACE_IDS.owner,
      name: "Property",
      display_address: null,
      purchase_date: null,
      purchase_price_cents: null,
      currency_code: "USD",
      notes: null,
      is_primary: false,
      archived_at: null,
      deleted_at: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...property
    });
  }

  for (const vendor of seed.vendors || []) {
    vendors.set(vendor.id, {
      workspace_id: WORKSPACE_IDS.owner,
      name: "Vendor",
      normalized_name: "vendor",
      category: null,
      contact_name: null,
      phone: null,
      email: null,
      website: null,
      notes: null,
      status: "active",
      source_confidence: "user_confirmed",
      archived_at: null,
      deleted_at: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...vendor
    });
  }

  for (const project of seed.projects || []) {
    projects.set(project.id, {
      workspace_id: WORKSPACE_IDS.owner,
      property_id: PROPERTY_IDS.ownerPrimary,
      vendor_id: null,
      name: "Project",
      category: "general",
      status: "planned",
      start_date: null,
      completion_date: null,
      contractor_name_raw: null,
      permit_number: null,
      scope_summary: null,
      notes: null,
      completeness_override_note: null,
      completeness_overridden_at: null,
      archived_at: null,
      deleted_at: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...project
    });
  }

  for (const expense of seed.expenses || []) {
    expenses.set(expense.id, {
      workspace_id: WORKSPACE_IDS.owner,
      property_id: PROPERTY_IDS.ownerPrimary,
      project_id: null,
      vendor_id: null,
      vendor_name_raw: null,
      expense_date: null,
      description: "Expense",
      amount_cents: 0,
      currency_code: "USD",
      category: "general",
      record_treatment: "review_later",
      documentation_status: "no_document_yet",
      notes: null,
      deleted_at: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...expense
    });
  }

  for (const document of seed.documents || []) {
    documents.set(document.id, {
      workspace_id: WORKSPACE_IDS.owner,
      property_id: PROPERTY_IDS.ownerPrimary,
      project_id: null,
      expense_id: null,
      display_name: "Document",
      document_type: "other",
      document_date: null,
      notes: null,
      file_availability: "not_uploaded",
      file_status_note: null,
      deleted_at: null,
      created_by_user_id: null,
      updated_by_user_id: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...document
    });
  }

  for (const file of seed.documentFiles || []) {
    documentFiles.set(file.id, {
      workspace_id: WORKSPACE_IDS.owner,
      document_id: DOCUMENT_IDS.ownerDeckReceipt,
      storage_provider: "test",
      storage_key: `private/${file.id}`,
      original_file_name: "receipt.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      sha256: null,
      source: "web_upload",
      status: "available",
      uploaded_by_user_id: null,
      uploaded_at: "2026-06-06T12:00:00.000Z",
      deleted_at: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...file
    });
  }

  for (const ocr of seed.documentOcr || []) {
    documentOcr.set(ocr.document_id, {
      id: makeUuid(documentOcrCounter++),
      workspace_id: WORKSPACE_IDS.owner,
      document_id: DOCUMENT_IDS.ownerDeckReceipt,
      document_file_id: DOCUMENT_FILE_IDS.ownerDeckReceipt,
      status: "not_requested",
      text: null,
      text_sha256: null,
      engine: null,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: "2026-06-06T12:00:00.000Z",
      updated_at: "2026-06-06T12:00:00.000Z",
      ...ocr
    });
  }

  const db = {
    queries,
    users,
    workspaces,
    memberships,
    properties,
    vendors,
    projects,
    expenses,
    documents,
    documentFiles,
    documentOcr,
    async query(sql, params = []) {
      queries.push({ sql, params });
      const normalizedSql = normalizeSql(sql);

      if (normalizedSql === "BEGIN" || normalizedSql === "COMMIT" || normalizedSql === "ROLLBACK") {
        return { rows: [] };
      }

      if (/INSERT INTO users/i.test(sql)) {
        return upsertUser(params);
      }

      if (/-- listActiveMembershipsForUser/.test(sql)) {
        return { rows: membershipRowsForUser(params[0], { workspaceShape: false }) };
      }

      if (/-- listUserWorkspaces/.test(sql)) {
        return { rows: membershipRowsForUser(params[0], { workspaceShape: true }) };
      }

      if (/-- loadWorkspaceMembership/.test(sql)) {
        return {
          rows: membershipRowsForUser(params[0], { workspaceId: params[1], workspaceShape: true })
        };
      }

      if (/-- createWorkspaceWithOwner\.workspace/.test(sql)) {
        const [name, ownerUserId] = params;
        const id = makeUuid(workspaceCounter++);
        const workspace = {
          id,
          name,
          owner_user_id: ownerUserId,
          status: "active",
          settings: {},
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z",
          deleted_at: null
        };
        workspaces.set(id, workspace);
        return { rows: [workspace] };
      }

      if (/-- createWorkspaceWithOwner\.membership/.test(sql)) {
        const [workspaceId, userId] = params;
        const membership = {
          id: makeUuid(membershipCounter++),
          workspace_id: workspaceId,
          user_id: userId,
          role: "owner",
          status: "active",
          removed_at: null,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        memberships.set(membership.id, membership);
        return { rows: [membership] };
      }

      if (/-- updateWorkspaceBasics/.test(sql)) {
        const [workspaceId, name] = params;
        const workspace = workspaces.get(workspaceId);
        if (!workspace || workspace.status !== "active" || workspace.deleted_at) {
          return { rows: [] };
        }
        workspace.name = name;
        workspace.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [workspace] };
      }

      if (/-- getDashboardSummary/.test(sql)) {
        return { rows: [dashboardSummaryRow(params[0])] };
      }

      if (/-- listExportProperties/.test(sql)) {
        return { rows: exportPropertyRows(params[0]) };
      }

      if (/-- listExportProjects/.test(sql)) {
        return { rows: exportProjectRows(params[0]) };
      }

      if (/-- listExportVendors/.test(sql)) {
        return { rows: exportVendorRows(params[0]) };
      }

      if (/-- listExportExpenses/.test(sql)) {
        return { rows: exportExpenseRows(params[0]) };
      }

      if (/-- listExportDocuments/.test(sql)) {
        return { rows: exportDocumentRows(params[0]) };
      }

      if (/-- listProperties/.test(sql)) {
        return listPropertiesRows(sql, params);
      }

      if (/-- getPropertyById/.test(sql)) {
        return { rows: propertyRows({ workspaceId: params[0], propertyId: params[1] }) };
      }

      if (/-- countActiveProperties/.test(sql)) {
        return {
          rows: [
            {
              count: propertyRows({ workspaceId: params[0] }).length
            }
          ]
        };
      }

      if (/-- clearPrimaryProperties/.test(sql)) {
        const [workspaceId, exceptPropertyId] = params;
        for (const property of properties.values()) {
          if (
            property.workspace_id === workspaceId &&
            property.deleted_at === null &&
            property.archived_at === null &&
            property.is_primary === true &&
            (!exceptPropertyId || property.id !== exceptPropertyId)
          ) {
            property.is_primary = false;
            property.updated_at = "2026-06-06T13:00:00.000Z";
          }
        }
        return { rows: [] };
      }

      if (/-- createProperty/.test(sql)) {
        const [
          workspaceId,
          name,
          displayAddress,
          purchaseDate,
          purchasePriceCents,
          currencyCode,
          notes,
          isPrimary,
          actorUserId
        ] = params;
        const property = {
          id: makeUuid(propertyCounter++),
          workspace_id: workspaceId,
          name,
          display_address: displayAddress,
          purchase_date: purchaseDate,
          purchase_price_cents: purchasePriceCents,
          currency_code: currencyCode,
          notes,
          is_primary: isPrimary,
          archived_at: null,
          deleted_at: null,
          created_by_user_id: actorUserId,
          updated_by_user_id: actorUserId,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        properties.set(property.id, property);
        return { rows: [property] };
      }

      if (/-- updateProperty/.test(sql)) {
        return updatePropertyRow(params);
      }

      if (/-- archiveProperty/.test(sql)) {
        const [workspaceId, propertyId, actorUserId] = params;
        const property = properties.get(propertyId);
        if (!isActiveProperty(property, workspaceId)) {
          return { rows: [] };
        }
        property.archived_at = "2026-06-06T13:00:00.000Z";
        property.is_primary = false;
        property.updated_by_user_id = actorUserId;
        property.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [property] };
      }

      if (/-- listVendors/.test(sql)) {
        return listVendorsRows(sql, params);
      }

      if (/-- getVendorById/.test(sql)) {
        return { rows: vendorRows({ workspaceId: params[0], vendorId: params[1] }) };
      }

      if (/-- createVendor/.test(sql)) {
        const [
          workspaceId,
          name,
          normalizedName,
          category,
          contactName,
          phone,
          email,
          website,
          notes,
          status,
          actorUserId
        ] = params;
        const vendor = {
          id: makeUuid(vendorCounter++),
          workspace_id: workspaceId,
          name,
          normalized_name: normalizedName,
          category,
          contact_name: contactName,
          phone,
          email,
          website,
          notes,
          status,
          source_confidence: "user_confirmed",
          archived_at: status === "archived" ? "2026-06-06T13:00:00.000Z" : null,
          deleted_at: null,
          created_by_user_id: actorUserId,
          updated_by_user_id: actorUserId,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        vendors.set(vendor.id, vendor);
        return { rows: [vendor] };
      }

      if (/-- updateVendor/.test(sql)) {
        return updateVendorRow(params);
      }

      if (/-- archiveVendor/.test(sql)) {
        const [workspaceId, vendorId, actorUserId] = params;
        const vendor = vendors.get(vendorId);
        if (!isActiveVendor(vendor, workspaceId)) {
          return { rows: [] };
        }
        vendor.archived_at = "2026-06-06T13:00:00.000Z";
        vendor.status = "archived";
        vendor.updated_by_user_id = actorUserId;
        vendor.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [vendor] };
      }

      if (/-- loadProjectProperty/.test(sql)) {
        return { rows: propertyRows({ workspaceId: params[0], propertyId: params[1] }) };
      }

      if (/-- loadProjectVendor/.test(sql)) {
        return { rows: vendorRows({ workspaceId: params[0], vendorId: params[1] }) };
      }

      if (/-- listProjects/.test(sql)) {
        return listProjectsRows(sql, params);
      }

      if (/-- projectFilterOptions/.test(sql)) {
        return { rows: listProjectsRows(sql, params, { noPagination: true }).rows };
      }

      if (/-- getProjectByIdIncludingArchived/.test(sql)) {
        return {
          rows: projectRows({
            workspaceId: params[0],
            projectId: params[1],
            includeArchived: true
          })
        };
      }

      if (/-- getProjectById/.test(sql)) {
        return { rows: projectRows({ workspaceId: params[0], projectId: params[1] }) };
      }

      if (/-- createProject/.test(sql)) {
        const [
          workspaceId,
          propertyId,
          vendorId,
          name,
          category,
          status,
          startDate,
          completionDate,
          contractorNameRaw,
          permitNumber,
          scopeSummary,
          notes,
          completenessOverrideNote,
          actorUserId
        ] = params;
        const project = {
          id: makeUuid(projectCounter++),
          workspace_id: workspaceId,
          property_id: propertyId,
          vendor_id: vendorId,
          name,
          category,
          status,
          start_date: startDate,
          completion_date: completionDate,
          contractor_name_raw: contractorNameRaw,
          permit_number: permitNumber,
          scope_summary: scopeSummary,
          notes,
          completeness_override_note: completenessOverrideNote,
          completeness_overridden_at: completenessOverrideNote ? "2026-06-06T13:00:00.000Z" : null,
          archived_at: status === "archived" ? "2026-06-06T13:00:00.000Z" : null,
          deleted_at: null,
          created_by_user_id: actorUserId,
          updated_by_user_id: actorUserId,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        projects.set(project.id, project);
        return { rows: [{ id: project.id }] };
      }

      if (/-- updateProject/.test(sql)) {
        return updateProjectRow(params);
      }

      if (/-- archiveProject/.test(sql)) {
        const [workspaceId, projectId, actorUserId] = params;
        const project = projects.get(projectId);
        if (!isActiveProject(project, workspaceId)) {
          return { rows: [] };
        }
        project.archived_at = "2026-06-06T13:00:00.000Z";
        project.status = "archived";
        project.updated_by_user_id = actorUserId;
        project.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [{ id: project.id }] };
      }

      if (/-- loadExpenseProperty/.test(sql)) {
        return { rows: propertyRows({ workspaceId: params[0], propertyId: params[1] }) };
      }

      if (/-- loadExpenseProject/.test(sql)) {
        return { rows: projectRows({ workspaceId: params[0], projectId: params[1] }).map((project) => ({
          id: project.id,
          name: project.name,
          property_id: project.property_id
        })) };
      }

      if (/-- loadExpenseVendor/.test(sql)) {
        return { rows: vendorRows({ workspaceId: params[0], vendorId: params[1] }) };
      }

      if (/-- getExpenseRelationshipState/.test(sql)) {
        const expense = expenses.get(params[1]);
        if (!isActiveExpense(expense, params[0])) {
          return { rows: [] };
        }
        return {
          rows: [
            {
              property_id: expense.property_id,
              project_id: expense.project_id,
              vendor_id: expense.vendor_id
            }
          ]
        };
      }

      if (/-- listExpenses/.test(sql)) {
        return listExpensesRows(sql, params);
      }

      if (/-- expenseFilterOptions/.test(sql)) {
        return { rows: listExpensesRows(sql, params, { noPagination: true }).rows };
      }

      if (/-- getExpenseByIdIncludingDeleted/.test(sql)) {
        return {
          rows: expenseRows({
            workspaceId: params[0],
            expenseId: params[1],
            includeDeleted: true
          })
        };
      }

      if (/-- getExpenseById/.test(sql)) {
        return { rows: expenseRows({ workspaceId: params[0], expenseId: params[1] }) };
      }

      if (/-- createExpense/.test(sql)) {
        const [
          workspaceId,
          propertyId,
          projectId,
          vendorId,
          vendorNameRaw,
          expenseDate,
          description,
          amountCents,
          currencyCode,
          category,
          recordTreatment,
          documentationStatus,
          notes,
          actorUserId
        ] = params;
        const expense = {
          id: makeUuid(expenseCounter++),
          workspace_id: workspaceId,
          property_id: propertyId,
          project_id: projectId,
          vendor_id: vendorId,
          vendor_name_raw: vendorNameRaw,
          expense_date: expenseDate,
          description,
          amount_cents: amountCents,
          currency_code: currencyCode,
          category,
          record_treatment: recordTreatment,
          documentation_status: documentationStatus,
          notes,
          deleted_at: null,
          created_by_user_id: actorUserId,
          updated_by_user_id: actorUserId,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        expenses.set(expense.id, expense);
        return { rows: [{ id: expense.id }] };
      }

      if (/-- updateExpense/.test(sql)) {
        return updateExpenseRow(params);
      }

      if (/-- deleteExpense/.test(sql)) {
        const [workspaceId, expenseId, actorUserId] = params;
        const expense = expenses.get(expenseId);
        if (!isActiveExpense(expense, workspaceId)) {
          return { rows: [] };
        }
        expense.deleted_at = "2026-06-06T13:00:00.000Z";
        expense.updated_by_user_id = actorUserId;
        expense.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [{ id: expense.id }] };
      }

      if (/-- loadDocumentProperty/.test(sql)) {
        return { rows: propertyRows({ workspaceId: params[0], propertyId: params[1] }) };
      }

      if (/-- loadDocumentProject/.test(sql)) {
        return { rows: projectRows({ workspaceId: params[0], projectId: params[1] }).map((project) => ({
          id: project.id,
          name: project.name,
          property_id: project.property_id
        })) };
      }

      if (/-- loadDocumentExpense/.test(sql)) {
        const expense = expenses.get(params[1]);
        if (!isActiveExpense(expense, params[0])) {
          return { rows: [] };
        }
        return {
          rows: [
            {
              id: expense.id,
              description: expense.description,
              property_id: expense.property_id,
              project_id: expense.project_id
            }
          ]
        };
      }

      if (/-- getDocumentRelationshipState/.test(sql)) {
        const document = documents.get(params[1]);
        if (!isActiveDocument(document, params[0])) {
          return { rows: [] };
        }
        return {
          rows: [
            {
              property_id: document.property_id,
              project_id: document.project_id,
              expense_id: document.expense_id
            }
          ]
        };
      }

      if (/-- getActiveDocumentFileState/.test(sql)) {
        const document = documents.get(params[1]);
        return { rows: isActiveDocument(document, params[0]) ? [{ id: document.id }] : [] };
      }

      if (/-- getActiveDocumentFile/.test(sql)) {
        return {
          rows: activeDocumentFiles(params[0], params[1]).slice(0, 1)
        };
      }

      if (/-- getDocumentFileById/.test(sql)) {
        const [workspaceId, documentId, documentFileId] = params;
        const file = documentFiles.get(documentFileId);
        return {
          rows: file && file.workspace_id === workspaceId && file.document_id === documentId && file.deleted_at === null
            ? [file]
            : []
        };
      }

      if (/-- getDocumentOcrRow/.test(sql)) {
        return {
          rows: documentOcrRows({
            workspaceId: params[0],
            documentId: params[1],
            includeText: /o\.text AS ocr_text/.test(sql)
          })
        };
      }

      if (/-- upsertDocumentOcr/.test(sql)) {
        const [
          workspaceId,
          documentId,
          documentFileId,
          status,
          text,
          textSha256,
          engine,
          errorCode,
          errorMessage,
          completed
        ] = params;
        const existing = documentOcr.get(documentId);
        const ocr = {
          id: existing?.id || makeUuid(documentOcrCounter++),
          workspace_id: workspaceId,
          document_id: documentId,
          document_file_id: documentFileId,
          status,
          text,
          text_sha256: textSha256,
          engine,
          error_code: errorCode,
          error_message: errorMessage,
          started_at: "2026-06-06T13:00:00.000Z",
          completed_at: completed ? "2026-06-06T13:00:00.000Z" : null,
          created_at: existing?.created_at || "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T13:00:00.000Z"
        };
        documentOcr.set(documentId, ocr);
        return { rows: [] };
      }

      if (/-- listDocuments/.test(sql)) {
        return listDocumentsRows(sql, params);
      }

      if (/-- documentFilterOptions/.test(sql)) {
        return { rows: listDocumentsRows(sql, params, { noPagination: true }).rows };
      }

      if (/-- getDocumentByIdIncludingDeleted/.test(sql)) {
        return {
          rows: documentRows({
            workspaceId: params[0],
            documentId: params[1],
            includeDeleted: true
          })
        };
      }

      if (/-- getDocumentById/.test(sql)) {
        return { rows: documentRows({ workspaceId: params[0], documentId: params[1] }) };
      }

      if (/-- createDocument\s*\n/.test(sql)) {
        const [
          workspaceId,
          propertyId,
          projectId,
          expenseId,
          displayName,
          documentType,
          documentDate,
          notes,
          fileAvailability,
          fileStatusNote,
          actorUserId
        ] = params;
        const document = {
          id: makeUuid(documentCounter++),
          workspace_id: workspaceId,
          property_id: propertyId,
          project_id: projectId,
          expense_id: expenseId,
          display_name: displayName,
          document_type: documentType,
          document_date: documentDate,
          notes,
          file_availability: fileAvailability,
          file_status_note: fileStatusNote,
          deleted_at: null,
          created_by_user_id: actorUserId,
          updated_by_user_id: actorUserId,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        documents.set(document.id, document);
        return { rows: [{ id: document.id }] };
      }

      if (/-- createDocumentFileIntent/.test(sql)) {
        const [
          workspaceId,
          documentId,
          storageProvider,
          originalFileName,
          mimeType,
          sizeBytes,
          sha256,
          source,
          actorUserId
        ] = params;
        const file = {
          id: makeUuid(documentFileCounter++),
          workspace_id: workspaceId,
          document_id: documentId,
          storage_provider: storageProvider,
          storage_key: "pending",
          original_file_name: originalFileName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          sha256,
          source,
          status: "pending_upload",
          uploaded_by_user_id: actorUserId,
          uploaded_at: null,
          deleted_at: null,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z"
        };
        documentFiles.set(file.id, file);
        return { rows: [{ id: file.id }] };
      }

      if (/-- setDocumentFileStorageKey/.test(sql)) {
        const [workspaceId, documentId, documentFileId, storageKey] = params;
        const file = documentFiles.get(documentFileId);
        if (!file || file.workspace_id !== workspaceId || file.document_id !== documentId || file.deleted_at !== null) {
          return { rows: [] };
        }
        file.storage_key = storageKey;
        file.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [{ id: file.id }] };
      }

      if (/-- deactivatePriorDocumentFiles/.test(sql)) {
        const [workspaceId, documentId, exceptFileId] = params;
        for (const file of documentFiles.values()) {
          if (
            file.workspace_id === workspaceId &&
            file.document_id === documentId &&
            file.id !== exceptFileId &&
            file.deleted_at === null &&
            file.status === "available"
          ) {
            file.status = "deleted";
            file.deleted_at = "2026-06-06T13:00:00.000Z";
            file.updated_at = "2026-06-06T13:00:00.000Z";
          }
        }
        return { rows: [] };
      }

      if (/-- completeDocumentFileUpload/.test(sql)) {
        const [workspaceId, documentId, documentFileId, sizeBytes, sha256, actorUserId] = params;
        const file = documentFiles.get(documentFileId);
        if (
          !file ||
          file.workspace_id !== workspaceId ||
          file.document_id !== documentId ||
          file.deleted_at !== null ||
          file.status !== "pending_upload"
        ) {
          return { rows: [] };
        }
        file.status = "available";
        file.size_bytes = sizeBytes;
        file.sha256 = sha256 || file.sha256;
        file.uploaded_by_user_id = actorUserId;
        file.uploaded_at = "2026-06-06T13:00:00.000Z";
        file.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [file] };
      }

      if (/-- updateDocumentFileAvailability/.test(sql)) {
        const [workspaceId, documentId, fileAvailability, fileStatusNote, actorUserId] = params;
        const document = documents.get(documentId);
        if (!isActiveDocument(document, workspaceId)) {
          return { rows: [] };
        }
        document.file_availability = fileAvailability;
        document.file_status_note = fileStatusNote;
        document.updated_by_user_id = actorUserId;
        document.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [] };
      }

      if (/-- deleteDocumentFile/.test(sql)) {
        const [workspaceId, documentId, documentFileId] = params;
        const file = documentFiles.get(documentFileId);
        if (!file || file.workspace_id !== workspaceId || file.document_id !== documentId || file.deleted_at !== null) {
          return { rows: [] };
        }
        file.status = "deleted";
        file.deleted_at = "2026-06-06T13:00:00.000Z";
        file.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [file] };
      }

      if (/-- updateDocument/.test(sql)) {
        return updateDocumentRow(params);
      }

      if (/-- deleteDocument/.test(sql)) {
        const [workspaceId, documentId, actorUserId] = params;
        const document = documents.get(documentId);
        if (!isActiveDocument(document, workspaceId)) {
          return { rows: [] };
        }
        document.deleted_at = "2026-06-06T13:00:00.000Z";
        document.updated_by_user_id = actorUserId;
        document.updated_at = "2026-06-06T13:00:00.000Z";
        return { rows: [{ id: document.id }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    async connect() {
      return {
        query: db.query,
        release() {}
      };
    }
  };

  function upsertUser(params) {
    const [email, displayName] = params;
    const normalizedEmail = email.toLowerCase();
    const existing = [...users.values()].find((user) => user.email === normalizedEmail && !user.deleted_at);
    const user = existing || {
      id: makeUuid(userCounter++),
      email: normalizedEmail,
      display_name: displayName,
      status: "active",
      deleted_at: null
    };
    users.set(user.id, user);
    return {
      rows: [
        {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          status: user.status
        }
      ]
    };
  }

  function membershipRowsForUser(userId, { workspaceId, workspaceShape }) {
    return [...memberships.values()]
      .filter((membership) => membership.user_id === userId)
      .filter((membership) => !workspaceId || membership.workspace_id === workspaceId)
      .filter((membership) => membership.status === "active" && !membership.removed_at)
      .map((membership) => {
        const workspace = workspaces.get(membership.workspace_id);
        if (!workspace || workspace.status !== "active" || workspace.deleted_at) {
          return null;
        }

        if (workspaceShape) {
          return {
            id: workspace.id,
            name: workspace.name,
            status: workspace.status,
            settings: workspace.settings,
            created_at: workspace.created_at,
            updated_at: workspace.updated_at,
            membership_id: membership.id,
            role: membership.role
          };
        }

        return {
          membership_id: membership.id,
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          role: membership.role
        };
      })
      .filter(Boolean);
  }

  function listPropertiesRows(sql, params) {
    const workspaceId = params[0];
    const limit = params[params.length - 2];
    const offset = params[params.length - 1];
    const hasQ = /ILIKE/.test(sql);
    const qParam = hasQ ? params.find((value) => typeof value === "string" && value.startsWith("%")) : "";
    const query = qParam ? qParam.replace(/^%|%$/g, "").toLowerCase() : "";
    const isPrimaryFilter = /is_primary =/.test(sql)
      ? params.find((value) => typeof value === "boolean")
      : undefined;

    let rows = [...properties.values()]
      .filter((property) => property.workspace_id === workspaceId)
      .filter((property) => property.deleted_at === null);

    if (/archived_at IS NOT NULL/.test(sql)) {
      rows = rows.filter((property) => property.archived_at !== null);
    } else if (/archived_at IS NULL/.test(sql)) {
      rows = rows.filter((property) => property.archived_at === null);
    }

    if (isPrimaryFilter !== undefined) {
      rows = rows.filter((property) => property.is_primary === isPrimaryFilter);
    }

    if (query) {
      rows = rows.filter((property) => {
        return property.name.toLowerCase().includes(query) ||
          String(property.display_address || "").toLowerCase().includes(query);
      });
    }

    rows.sort((left, right) => {
      if (/ORDER BY name DESC/.test(sql)) {
        return right.name.localeCompare(left.name) || left.id.localeCompare(right.id);
      }
      if (/ORDER BY updated_at DESC/.test(sql)) {
        return String(right.updated_at).localeCompare(String(left.updated_at)) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY created_at DESC/.test(sql)) {
        return String(right.created_at).localeCompare(String(left.created_at)) ||
          left.id.localeCompare(right.id);
      }
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });

    const total = rows.length;
    return {
      rows: rows.slice(offset, offset + limit).map((property) => ({
        ...property,
        total_count: total
      }))
    };
  }

  function propertyRows({ workspaceId, propertyId }) {
    return [...properties.values()]
      .filter((property) => property.workspace_id === workspaceId)
      .filter((property) => !propertyId || property.id === propertyId)
      .filter((property) => property.deleted_at === null && property.archived_at === null);
  }

  function updatePropertyRow(params) {
    const [
      workspaceId,
      propertyId,
      hasName,
      name,
      hasDisplayAddress,
      displayAddress,
      hasPurchaseDate,
      purchaseDate,
      hasPurchasePriceCents,
      purchasePriceCents,
      hasCurrencyCode,
      currencyCode,
      hasNotes,
      notes,
      hasIsPrimary,
      isPrimary,
      actorUserId
    ] = params;

    const property = properties.get(propertyId);
    if (!isActiveProperty(property, workspaceId)) {
      return { rows: [] };
    }

    if (hasName) property.name = name;
    if (hasDisplayAddress) property.display_address = displayAddress;
    if (hasPurchaseDate) property.purchase_date = purchaseDate;
    if (hasPurchasePriceCents) property.purchase_price_cents = purchasePriceCents;
    if (hasCurrencyCode) property.currency_code = currencyCode;
    if (hasNotes) property.notes = notes;
    if (hasIsPrimary) property.is_primary = isPrimary;
    property.updated_by_user_id = actorUserId;
    property.updated_at = "2026-06-06T13:00:00.000Z";

    return { rows: [property] };
  }

  function isActiveProperty(property, workspaceId) {
    return property &&
      property.workspace_id === workspaceId &&
      property.deleted_at === null &&
      property.archived_at === null;
  }

  function listVendorsRows(sql, params) {
    const workspaceId = params[0];
    const limit = params[params.length - 2];
    const offset = params[params.length - 1];
    const hasQ = /ILIKE/.test(sql);
    const qParam = hasQ ? params.find((value) => typeof value === "string" && value.startsWith("%")) : "";
    const query = qParam ? qParam.replace(/^%|%$/g, "").toLowerCase() : "";
    const categoryFilter = valueForSqlMarker(sql, params, "category");
    const statusFilter = valueForSqlMarker(sql, params, "status");
    const confidenceFilter = valueForSqlMarker(sql, params, "source_confidence");

    let rows = [...vendors.values()]
      .filter((vendor) => vendor.workspace_id === workspaceId)
      .filter((vendor) => vendor.deleted_at === null);

    if (/archived_at IS NOT NULL/.test(sql)) {
      rows = rows.filter((vendor) => vendor.archived_at !== null);
    } else if (/archived_at IS NULL/.test(sql)) {
      rows = rows.filter((vendor) => vendor.archived_at === null);
    }

    if (categoryFilter) {
      rows = rows.filter((vendor) => vendor.category === categoryFilter);
    }

    if (statusFilter) {
      rows = rows.filter((vendor) => vendor.status === statusFilter);
    }

    if (confidenceFilter) {
      rows = rows.filter((vendor) => vendor.source_confidence === confidenceFilter);
    }

    if (query) {
      rows = rows.filter((vendor) => {
        return vendor.name.toLowerCase().includes(query) ||
          String(vendor.normalized_name || "").toLowerCase().includes(query) ||
          String(vendor.contact_name || "").toLowerCase().includes(query) ||
          String(vendor.email || "").toLowerCase().includes(query) ||
          String(vendor.phone || "").toLowerCase().includes(query);
      });
    }

    rows.sort((left, right) => {
      if (/ORDER BY name DESC/.test(sql)) {
        return right.name.localeCompare(left.name) || left.id.localeCompare(right.id);
      }
      if (/ORDER BY category DESC/.test(sql)) {
        return String(right.category || "").localeCompare(String(left.category || "")) ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY category ASC/.test(sql)) {
        return String(left.category || "").localeCompare(String(right.category || "")) ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY updated_at DESC/.test(sql)) {
        return String(right.updated_at).localeCompare(String(left.updated_at)) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY created_at DESC/.test(sql)) {
        return String(right.created_at).localeCompare(String(left.created_at)) ||
          left.id.localeCompare(right.id);
      }
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    });

    const total = rows.length;
    return {
      rows: rows.slice(offset, offset + limit).map((vendor) => ({
        ...vendor,
        total_count: total
      }))
    };
  }

  function vendorRows({ workspaceId, vendorId }) {
    return [...vendors.values()]
      .filter((vendor) => vendor.workspace_id === workspaceId)
      .filter((vendor) => !vendorId || vendor.id === vendorId)
      .filter((vendor) => vendor.deleted_at === null && vendor.archived_at === null);
  }

  function updateVendorRow(params) {
    const [
      workspaceId,
      vendorId,
      hasName,
      name,
      normalizedName,
      hasCategory,
      category,
      hasContactName,
      contactName,
      hasPhone,
      phone,
      hasEmail,
      email,
      hasWebsite,
      website,
      hasNotes,
      notes,
      hasStatus,
      status,
      actorUserId
    ] = params;

    const vendor = vendors.get(vendorId);
    if (!isActiveVendor(vendor, workspaceId)) {
      return { rows: [] };
    }

    if (hasName) {
      vendor.name = name;
      vendor.normalized_name = normalizedName;
    }
    if (hasCategory) vendor.category = category;
    if (hasContactName) vendor.contact_name = contactName;
    if (hasPhone) vendor.phone = phone;
    if (hasEmail) vendor.email = email;
    if (hasWebsite) vendor.website = website;
    if (hasNotes) vendor.notes = notes;
    if (hasStatus) {
      vendor.status = status;
      vendor.archived_at = status === "archived" ? "2026-06-06T13:00:00.000Z" : null;
    }
    vendor.updated_by_user_id = actorUserId;
    vendor.updated_at = "2026-06-06T13:00:00.000Z";

    return { rows: [vendor] };
  }

  function isActiveVendor(vendor, workspaceId) {
    return vendor &&
      vendor.workspace_id === workspaceId &&
      vendor.deleted_at === null &&
      vendor.archived_at === null;
  }

  function listProjectsRows(sql, params, { noPagination = false } = {}) {
    const workspaceId = params[0];
    const limit = noPagination ? undefined : params[params.length - 2];
    const offset = noPagination ? 0 : params[params.length - 1];
    const hasQ = /ILIKE/.test(sql);
    const qParam = hasQ ? params.find((value) => typeof value === "string" && value.startsWith("%")) : "";
    const query = qParam ? qParam.replace(/^%|%$/g, "").toLowerCase() : "";
    const propertyFilter = valueForSqlMarker(sql, params, "pr.property_id");
    const vendorFilter = valueForSqlMarker(sql, params, "pr.vendor_id");
    const statusFilter = valueForSqlMarker(sql, params, "pr.status");
    const categoryFilter = valueForSqlMarker(sql, params, "pr.category");
    const startFrom = valueForSqlComparison(sql, params, "pr.start_date", ">=");
    const startTo = valueForSqlComparison(sql, params, "pr.start_date", "<=");
    const completionFrom = valueForSqlComparison(sql, params, "pr.completion_date", ">=");
    const completionTo = valueForSqlComparison(sql, params, "pr.completion_date", "<=");

    let rows = [...projects.values()]
      .filter((project) => project.workspace_id === workspaceId)
      .filter((project) => project.deleted_at === null);

    if (/pr\.archived_at IS NOT NULL/.test(sql)) {
      rows = rows.filter((project) => project.archived_at !== null);
    } else if (/pr\.archived_at IS NULL/.test(sql)) {
      rows = rows.filter((project) => project.archived_at === null);
    }

    if (/pr\.vendor_id IS NULL/.test(sql)) {
      rows = rows.filter((project) => project.vendor_id === null);
    }
    if (propertyFilter) rows = rows.filter((project) => project.property_id === propertyFilter);
    if (vendorFilter) rows = rows.filter((project) => project.vendor_id === vendorFilter);
    if (statusFilter) rows = rows.filter((project) => project.status === statusFilter);
    if (categoryFilter) rows = rows.filter((project) => project.category === categoryFilter);
    if (startFrom) rows = rows.filter((project) => project.start_date && project.start_date >= startFrom);
    if (startTo) rows = rows.filter((project) => project.start_date && project.start_date <= startTo);
    if (completionFrom) rows = rows.filter((project) => project.completion_date && project.completion_date >= completionFrom);
    if (completionTo) rows = rows.filter((project) => project.completion_date && project.completion_date <= completionTo);

    if (query) {
      rows = rows.filter((project) => {
        return project.name.toLowerCase().includes(query) ||
          String(project.scope_summary || "").toLowerCase().includes(query);
      });
    }

    rows.sort((left, right) => {
      if (/ORDER BY pr\.name DESC/.test(sql)) {
        return right.name.localeCompare(left.name) || left.id.localeCompare(right.id);
      }
      if (/ORDER BY pr\.name ASC/.test(sql)) {
        return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
      }
      if (/ORDER BY pr\.status/.test(sql)) {
        return left.status.localeCompare(right.status) ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY pr\.category/.test(sql)) {
        return left.category.localeCompare(right.category) ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY pr\.start_date DESC/.test(sql)) {
        return String(right.start_date || "").localeCompare(String(left.start_date || "")) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY pr\.completion_date DESC/.test(sql)) {
        return String(right.completion_date || "").localeCompare(String(left.completion_date || "")) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY pr\.created_at DESC/.test(sql)) {
        return String(right.created_at).localeCompare(String(left.created_at)) ||
          left.id.localeCompare(right.id);
      }
      return String(right.updated_at).localeCompare(String(left.updated_at)) ||
        left.id.localeCompare(right.id);
    });

    const total = rows.length;
    const page = noPagination ? rows : rows.slice(offset, offset + limit);
    return {
      rows: page.map((project) => projectRow(project, total))
    };
  }

  function projectRows({ workspaceId, projectId, includeArchived = false }) {
    return [...projects.values()]
      .filter((project) => project.workspace_id === workspaceId)
      .filter((project) => !projectId || project.id === projectId)
      .filter((project) => project.deleted_at === null)
      .filter((project) => includeArchived || project.archived_at === null)
      .map((project) => projectRow(project));
  }

  function updateProjectRow(params) {
    const [
      workspaceId,
      projectId,
      hasPropertyId,
      propertyId,
      hasVendorId,
      vendorId,
      hasName,
      name,
      hasCategory,
      category,
      hasStatus,
      status,
      hasStartDate,
      startDate,
      hasCompletionDate,
      completionDate,
      hasContractorNameRaw,
      contractorNameRaw,
      hasPermitNumber,
      permitNumber,
      hasScopeSummary,
      scopeSummary,
      hasNotes,
      notes,
      hasCompletenessOverrideNote,
      completenessOverrideNote,
      actorUserId
    ] = params;

    const project = projects.get(projectId);
    if (!isActiveProject(project, workspaceId)) {
      return { rows: [] };
    }

    if (hasPropertyId) project.property_id = propertyId;
    if (hasVendorId) project.vendor_id = vendorId;
    if (hasName) project.name = name;
    if (hasCategory) project.category = category;
    if (hasStatus) {
      project.status = status;
      project.archived_at = status === "archived" ? "2026-06-06T13:00:00.000Z" : null;
    }
    if (hasStartDate) project.start_date = startDate;
    if (hasCompletionDate) project.completion_date = completionDate;
    if (hasContractorNameRaw) project.contractor_name_raw = contractorNameRaw;
    if (hasPermitNumber) project.permit_number = permitNumber;
    if (hasScopeSummary) project.scope_summary = scopeSummary;
    if (hasNotes) project.notes = notes;
    if (hasCompletenessOverrideNote) {
      project.completeness_override_note = completenessOverrideNote;
      project.completeness_overridden_at = completenessOverrideNote ? "2026-06-06T13:00:00.000Z" : null;
    }
    project.updated_by_user_id = actorUserId;
    project.updated_at = "2026-06-06T13:00:00.000Z";

    return { rows: [{ id: project.id }] };
  }

  function isActiveProject(project, workspaceId) {
    return project &&
      project.workspace_id === workspaceId &&
      project.deleted_at === null &&
      project.archived_at === null;
  }

  function projectRow(project, totalCount) {
    const property = properties.get(project.property_id);
    const vendor = project.vendor_id ? vendors.get(project.vendor_id) : null;
    return {
      ...project,
      property_name: property?.name || null,
      vendor_name: vendor?.name || null,
      total_count: totalCount
    };
  }

  function listExpensesRows(sql, params, { noPagination = false } = {}) {
    const workspaceId = params[0];
    const limit = noPagination ? undefined : params[params.length - 2];
    const offset = noPagination ? 0 : params[params.length - 1];
    const hasQ = /ILIKE/.test(sql);
    const qParam = hasQ ? params.find((value) => typeof value === "string" && value.startsWith("%")) : "";
    const query = qParam ? qParam.replace(/^%|%$/g, "").toLowerCase() : "";
    const propertyFilter = valueForSqlMarker(sql, params, "e.property_id");
    const projectFilter = valueForSqlMarker(sql, params, "e.project_id");
    const vendorFilter = valueForSqlMarker(sql, params, "e.vendor_id");
    const categoryFilter = valueForSqlMarker(sql, params, "e.category");
    const treatmentFilter = valueForSqlMarker(sql, params, "e.record_treatment");
    const documentationFilter = valueForSqlMarker(sql, params, "e.documentation_status");
    const currencyFilter = valueForSqlMarker(sql, params, "e.currency_code");
    const dateFrom = valueForSqlComparison(sql, params, "e.expense_date", ">=");
    const dateTo = valueForSqlComparison(sql, params, "e.expense_date", "<=");
    const amountMin = valueForSqlComparison(sql, params, "e.amount_cents", ">=");
    const amountMax = valueForSqlComparison(sql, params, "e.amount_cents", "<=");

    let rows = [...expenses.values()]
      .filter((expense) => expense.workspace_id === workspaceId)
      .filter((expense) => expense.deleted_at === null);

    if (/e\.project_id IS NULL/.test(sql)) {
      rows = rows.filter((expense) => expense.project_id === null);
    }
    if (/e\.vendor_id IS NULL/.test(sql)) {
      rows = rows.filter((expense) => expense.vendor_id === null);
    }
    if (propertyFilter) rows = rows.filter((expense) => expense.property_id === propertyFilter);
    if (projectFilter) rows = rows.filter((expense) => expense.project_id === projectFilter);
    if (vendorFilter) rows = rows.filter((expense) => expense.vendor_id === vendorFilter);
    if (categoryFilter) rows = rows.filter((expense) => expense.category === categoryFilter);
    if (treatmentFilter) rows = rows.filter((expense) => expense.record_treatment === treatmentFilter);
    if (documentationFilter) rows = rows.filter((expense) => expense.documentation_status === documentationFilter);
    if (currencyFilter) rows = rows.filter((expense) => expense.currency_code === currencyFilter);
    if (dateFrom) rows = rows.filter((expense) => expense.expense_date && expense.expense_date >= dateFrom);
    if (dateTo) rows = rows.filter((expense) => expense.expense_date && expense.expense_date <= dateTo);
    if (amountMin !== "") rows = rows.filter((expense) => Number(expense.amount_cents) >= Number(amountMin));
    if (amountMax !== "") rows = rows.filter((expense) => Number(expense.amount_cents) <= Number(amountMax));

    if (query) {
      rows = rows.filter((expense) => {
        return expense.description.toLowerCase().includes(query) ||
          String(expense.vendor_name_raw || "").toLowerCase().includes(query) ||
          String(expense.notes || "").toLowerCase().includes(query);
      });
    }

    rows.sort((left, right) => {
      if (/ORDER BY e\.expense_date ASC/.test(sql)) {
        return String(left.expense_date || "").localeCompare(String(right.expense_date || "")) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY e\.amount_cents DESC/.test(sql)) {
        return Number(right.amount_cents) - Number(left.amount_cents) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY e\.amount_cents ASC/.test(sql)) {
        return Number(left.amount_cents) - Number(right.amount_cents) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY COALESCE\(v\.name/.test(sql)) {
        const leftVendor = String(expenseRow(left).vendor_name || left.vendor_name_raw || "");
        const rightVendor = String(expenseRow(right).vendor_name || right.vendor_name_raw || "");
        return leftVendor.localeCompare(rightVendor) ||
          String(right.expense_date || "").localeCompare(String(left.expense_date || "")) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY e\.category ASC/.test(sql)) {
        return left.category.localeCompare(right.category) ||
          String(right.expense_date || "").localeCompare(String(left.expense_date || "")) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY e\.created_at DESC/.test(sql)) {
        return String(right.created_at).localeCompare(String(left.created_at)) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY e\.updated_at DESC/.test(sql)) {
        return String(right.updated_at).localeCompare(String(left.updated_at)) ||
          left.id.localeCompare(right.id);
      }
      return String(right.expense_date || "").localeCompare(String(left.expense_date || "")) ||
        String(right.created_at).localeCompare(String(left.created_at)) ||
        left.id.localeCompare(right.id);
    });

    const total = rows.length;
    const page = noPagination ? rows : rows.slice(offset, offset + limit);
    return {
      rows: page.map((expense) => expenseRow(expense, total))
    };
  }

  function expenseRows({ workspaceId, expenseId, includeDeleted = false }) {
    return [...expenses.values()]
      .filter((expense) => expense.workspace_id === workspaceId)
      .filter((expense) => !expenseId || expense.id === expenseId)
      .filter((expense) => includeDeleted || expense.deleted_at === null)
      .map((expense) => expenseRow(expense));
  }

  function updateExpenseRow(params) {
    const [
      workspaceId,
      expenseId,
      hasPropertyId,
      propertyId,
      hasProjectId,
      projectId,
      hasVendorId,
      vendorId,
      hasVendorNameRaw,
      vendorNameRaw,
      hasExpenseDate,
      expenseDate,
      hasDescription,
      description,
      hasAmountCents,
      amountCents,
      hasCurrencyCode,
      currencyCode,
      hasCategory,
      category,
      hasRecordTreatment,
      recordTreatment,
      hasDocumentationStatus,
      documentationStatus,
      hasNotes,
      notes,
      actorUserId
    ] = params;

    const expense = expenses.get(expenseId);
    if (!isActiveExpense(expense, workspaceId)) {
      return { rows: [] };
    }

    if (hasPropertyId) expense.property_id = propertyId;
    if (hasProjectId) expense.project_id = projectId;
    if (hasVendorId) expense.vendor_id = vendorId;
    if (hasVendorNameRaw) expense.vendor_name_raw = vendorNameRaw;
    if (hasExpenseDate) expense.expense_date = expenseDate;
    if (hasDescription) expense.description = description;
    if (hasAmountCents) expense.amount_cents = amountCents;
    if (hasCurrencyCode) expense.currency_code = currencyCode;
    if (hasCategory) expense.category = category;
    if (hasRecordTreatment) expense.record_treatment = recordTreatment;
    if (hasDocumentationStatus) expense.documentation_status = documentationStatus;
    if (hasNotes) expense.notes = notes;
    expense.updated_by_user_id = actorUserId;
    expense.updated_at = "2026-06-06T13:00:00.000Z";

    return { rows: [{ id: expense.id }] };
  }

  function isActiveExpense(expense, workspaceId) {
    return expense &&
      expense.workspace_id === workspaceId &&
      expense.deleted_at === null;
  }

  function expenseRow(expense, totalCount) {
    const property = properties.get(expense.property_id);
    const project = expense.project_id ? projects.get(expense.project_id) : null;
    const vendor = expense.vendor_id ? vendors.get(expense.vendor_id) : null;
    return {
      ...expense,
      property_name: property?.name || null,
      project_name: project?.name || null,
      vendor_name: vendor?.name || null,
      document_count: 0,
      total_count: totalCount
    };
  }

  function listDocumentsRows(sql, params, { noPagination = false } = {}) {
    const workspaceId = params[0];
    const limit = noPagination ? undefined : params[params.length - 2];
    const offset = noPagination ? 0 : params[params.length - 1];
    const hasQ = /ILIKE/.test(sql);
    const qParam = hasQ ? params.find((value) => typeof value === "string" && value.startsWith("%")) : "";
    const query = qParam ? qParam.replace(/^%|%$/g, "").toLowerCase() : "";
    const propertyFilter = valueForSqlMarker(sql, params, "d.property_id");
    const projectFilter = valueForSqlMarker(sql, params, "d.project_id");
    const expenseFilter = valueForSqlMarker(sql, params, "d.expense_id");
    const documentTypeFilter = valueForSqlMarker(sql, params, "d.document_type");
    const fileAvailabilityFilter = valueForSqlMarker(sql, params, "d.file_availability");
    const dateFrom = valueForSqlComparison(sql, params, "d.document_date", ">=");
    const dateTo = valueForSqlComparison(sql, params, "d.document_date", "<=");

    let rows = [...documents.values()]
      .filter((document) => document.workspace_id === workspaceId)
      .filter((document) => document.deleted_at === null);

    if (/d\.project_id IS NULL/.test(sql)) {
      rows = rows.filter((document) => document.project_id === null);
    }
    if (/d\.expense_id IS NULL/.test(sql)) {
      rows = rows.filter((document) => document.expense_id === null);
    }
    if (propertyFilter) rows = rows.filter((document) => document.property_id === propertyFilter);
    if (projectFilter) rows = rows.filter((document) => document.project_id === projectFilter);
    if (expenseFilter) rows = rows.filter((document) => document.expense_id === expenseFilter);
    if (documentTypeFilter) rows = rows.filter((document) => document.document_type === documentTypeFilter);
    if (fileAvailabilityFilter) rows = rows.filter((document) => document.file_availability === fileAvailabilityFilter);
    if (dateFrom) rows = rows.filter((document) => document.document_date && document.document_date >= dateFrom);
    if (dateTo) rows = rows.filter((document) => document.document_date && document.document_date <= dateTo);

    if (query) {
      rows = rows.filter((document) => {
        return document.display_name.toLowerCase().includes(query) ||
          String(document.notes || "").toLowerCase().includes(query) ||
          String(document.file_status_note || "").toLowerCase().includes(query);
      });
    }

    rows.sort((left, right) => {
      if (/ORDER BY d\.document_date ASC/.test(sql)) {
        return String(left.document_date || "").localeCompare(String(right.document_date || "")) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY d\.display_name DESC/.test(sql)) {
        return right.display_name.localeCompare(left.display_name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY d\.display_name ASC/.test(sql)) {
        return left.display_name.localeCompare(right.display_name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY d\.document_type ASC/.test(sql)) {
        return left.document_type.localeCompare(right.document_type) ||
          left.display_name.localeCompare(right.display_name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY d\.file_availability ASC/.test(sql)) {
        return left.file_availability.localeCompare(right.file_availability) ||
          left.display_name.localeCompare(right.display_name) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY d\.created_at DESC/.test(sql)) {
        return String(right.created_at).localeCompare(String(left.created_at)) ||
          left.id.localeCompare(right.id);
      }
      if (/ORDER BY d\.updated_at DESC/.test(sql)) {
        return String(right.updated_at).localeCompare(String(left.updated_at)) ||
          left.id.localeCompare(right.id);
      }
      return String(right.document_date || "").localeCompare(String(left.document_date || "")) ||
        String(right.created_at).localeCompare(String(left.created_at)) ||
        left.id.localeCompare(right.id);
    });

    const total = rows.length;
    const page = noPagination ? rows : rows.slice(offset, offset + limit);
    return {
      rows: page.map((document) => documentRow(document, total))
    };
  }

  function documentRows({ workspaceId, documentId, includeDeleted = false }) {
    return [...documents.values()]
      .filter((document) => document.workspace_id === workspaceId)
      .filter((document) => !documentId || document.id === documentId)
      .filter((document) => includeDeleted || document.deleted_at === null)
      .map((document) => documentRow(document));
  }

  function updateDocumentRow(params) {
    const [
      workspaceId,
      documentId,
      hasPropertyId,
      propertyId,
      hasProjectId,
      projectId,
      hasExpenseId,
      expenseId,
      hasDisplayName,
      displayName,
      hasDocumentType,
      documentType,
      hasDocumentDate,
      documentDate,
      hasNotes,
      notes,
      hasFileAvailability,
      fileAvailability,
      hasFileStatusNote,
      fileStatusNote,
      actorUserId
    ] = params;

    const document = documents.get(documentId);
    if (!isActiveDocument(document, workspaceId)) {
      return { rows: [] };
    }

    if (hasPropertyId) document.property_id = propertyId;
    if (hasProjectId) document.project_id = projectId;
    if (hasExpenseId) document.expense_id = expenseId;
    if (hasDisplayName) document.display_name = displayName;
    if (hasDocumentType) document.document_type = documentType;
    if (hasDocumentDate) document.document_date = documentDate;
    if (hasNotes) document.notes = notes;
    if (hasFileAvailability) document.file_availability = fileAvailability;
    if (hasFileStatusNote) document.file_status_note = fileStatusNote;
    document.updated_by_user_id = actorUserId;
    document.updated_at = "2026-06-06T13:00:00.000Z";

    return { rows: [{ id: document.id }] };
  }

  function isActiveDocument(document, workspaceId) {
    return document &&
      document.workspace_id === workspaceId &&
      document.deleted_at === null;
  }

  function activeDocumentFiles(workspaceId, documentId) {
    return [...documentFiles.values()]
      .filter((file) => file.workspace_id === workspaceId && file.document_id === documentId && file.deleted_at === null)
      .sort((left, right) => {
        const statusRank = (file) => file.status === "available" ? 0 : 1;
        return statusRank(left) - statusRank(right) ||
          String(right.created_at).localeCompare(String(left.created_at)) ||
          left.id.localeCompare(right.id);
      });
  }

  function documentOcrRows({ workspaceId, documentId, includeText }) {
    const document = documents.get(documentId);
    if (!isActiveDocument(document, workspaceId)) {
      return [];
    }
    const file = activeDocumentFiles(workspaceId, documentId)[0] || null;
    const ocr = documentOcr.get(documentId);
    const textAvailable = Boolean(
      ocr?.text &&
      ocr.status === "succeeded" &&
      file?.status === "available" &&
      ocr.document_file_id === file.id
    );
    return [
      {
        document_id: documentId,
        active_file_id: file?.id || null,
        active_file_status: file?.status || null,
        document_file_id: ocr?.document_file_id || null,
        ocr_status: ocr?.status || "not_requested",
        ocr_engine: ocr?.engine || null,
        ocr_error_code: ocr?.error_code || null,
        ocr_error_message: ocr?.error_message || null,
        ocr_started_at: ocr?.started_at || null,
        ocr_completed_at: ocr?.completed_at || null,
        ocr_created_at: ocr?.created_at || null,
        ocr_text_available: textAvailable,
        ...(includeText ? { ocr_text: textAvailable ? ocr.text : null } : {})
      }
    ];
  }

  function documentRow(document, totalCount) {
    const property = properties.get(document.property_id);
    const project = document.project_id ? projects.get(document.project_id) : null;
    const expense = document.expense_id ? expenses.get(document.expense_id) : null;
    const file = activeDocumentFiles(document.workspace_id, document.id)[0] || null;
    const ocr = documentOcr.get(document.id);
    const ocrHasText = Boolean(
      ocr?.text &&
      ocr.status === "succeeded" &&
      file?.status === "available" &&
      ocr.document_file_id === file.id
    );
    return {
      ...document,
      property_name: property?.name || null,
      project_name: project?.name || null,
      expense_description: expense?.description || null,
      file_id: file?.id || null,
      file_original_file_name: file?.original_file_name || null,
      file_mime_type: file?.mime_type || null,
      file_size_bytes: file?.size_bytes || null,
      file_status: file?.status || null,
      ocr_status: ocr?.status || "not_requested",
      ocr_has_text: ocrHasText,
      ocr_completed_at: ocr?.completed_at || null,
      total_count: totalCount
    };
  }

  function exportPropertyRows(workspaceId) {
    return [...properties.values()]
      .filter((property) => property.workspace_id === workspaceId && property.deleted_at === null)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }

  function exportProjectRows(workspaceId) {
    return [...projects.values()]
      .filter((project) => project.workspace_id === workspaceId && project.deleted_at === null)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
      .map((project) => {
        const property = properties.get(project.property_id);
        const vendor = project.vendor_id ? vendors.get(project.vendor_id) : null;
        return {
          ...project,
          property_name: property?.name || null,
          vendor_name: vendor?.name || null
        };
      });
  }

  function exportVendorRows(workspaceId) {
    return [...vendors.values()]
      .filter((vendor) => vendor.workspace_id === workspaceId && vendor.deleted_at === null)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }

  function exportExpenseRows(workspaceId) {
    return [...expenses.values()]
      .filter((expense) => expense.workspace_id === workspaceId && expense.deleted_at === null)
      .sort((left, right) =>
        String(right.expense_date || "").localeCompare(String(left.expense_date || "")) ||
        String(right.created_at).localeCompare(String(left.created_at)) ||
        left.id.localeCompare(right.id)
      )
      .map((expense) => {
        const property = properties.get(expense.property_id);
        const project = expense.project_id ? projects.get(expense.project_id) : null;
        const vendor = expense.vendor_id ? vendors.get(expense.vendor_id) : null;
        const documentCount = [...documents.values()]
          .filter((document) => document.workspace_id === workspaceId && document.expense_id === expense.id && document.deleted_at === null)
          .length;
        return {
          ...expense,
          property_name: property?.name || null,
          project_name: project?.name || null,
          vendor_name: vendor?.name || null,
          document_count: documentCount
        };
      });
  }

  function exportDocumentRows(workspaceId) {
    return [...documents.values()]
      .filter((document) => document.workspace_id === workspaceId && document.deleted_at === null)
      .sort((left, right) =>
        String(right.document_date || "").localeCompare(String(left.document_date || "")) ||
        String(right.created_at).localeCompare(String(left.created_at)) ||
        left.id.localeCompare(right.id)
      )
      .map((document) => {
        const property = properties.get(document.property_id);
        const project = document.project_id ? projects.get(document.project_id) : null;
        const expense = document.expense_id ? expenses.get(document.expense_id) : null;
        const file = activeDocumentFiles(workspaceId, document.id)[0] || null;
        const ocr = documentOcr.get(document.id);
        const textAvailable = Boolean(
          ocr?.text &&
          ocr.status === "succeeded" &&
          file?.status === "available" &&
          ocr.document_file_id === file.id
        );
        return {
          ...document,
          property_name: property?.name || null,
          project_name: project?.name || null,
          expense_description: expense?.description || null,
          file_id: file?.id || null,
          file_original_file_name: file?.original_file_name || null,
          file_mime_type: file?.mime_type || null,
          file_size_bytes: file?.size_bytes || null,
          file_status: file?.status || null,
          ocr_status: ocr?.status || "not_requested",
          text_available: textAvailable
        };
      });
  }

  function dashboardSummaryRow(workspaceId) {
    const workspaceProperties = [...properties.values()]
      .filter((property) => property.workspace_id === workspaceId && property.deleted_at === null);
    const openProperties = workspaceProperties.filter((property) => property.archived_at === null);
    const workspaceProjects = [...projects.values()]
      .filter((project) => project.workspace_id === workspaceId && project.deleted_at === null);
    const openProjects = workspaceProjects.filter((project) => project.archived_at === null);
    const workspaceVendors = [...vendors.values()]
      .filter((vendor) => vendor.workspace_id === workspaceId && vendor.deleted_at === null);
    const openVendors = workspaceVendors.filter((vendor) => vendor.archived_at === null);
    const workspaceExpenses = [...expenses.values()]
      .filter((expense) => expense.workspace_id === workspaceId && expense.deleted_at === null);
    const workspaceDocuments = [...documents.values()]
      .filter((document) => document.workspace_id === workspaceId && document.deleted_at === null);

    const documentFileStates = workspaceDocuments.map((document) => {
      const file = activeDocumentFiles(workspaceId, document.id).find((candidate) => candidate.status === "available") || null;
      const ocr = documentOcr.get(document.id);
      return {
        document,
        hasAvailableFile: Boolean(file),
        hasOcrText: Boolean(
          file &&
          ocr?.text &&
          ocr.status === "succeeded" &&
          ocr.document_file_id === file.id
        ),
        hasPendingOcr: ["queued", "processing"].includes(ocr?.status)
      };
    });

    const expenseSupportCount = workspaceExpenses
      .filter((expense) => ["no_document_yet", "needs_follow_up"].includes(expense.documentation_status)).length;
    const missingFileCount = documentFileStates.filter((state) => !state.hasAvailableFile).length;
    const projectReviewCount = openProjects
      .filter((project) => project.status === "blocked" || (project.status === "completed" && !project.completion_date)).length;

    return {
      property_count: workspaceProperties.length,
      active_property_count: openProperties.length,
      archived_property_count: workspaceProperties.length - openProperties.length,
      project_count: workspaceProjects.length,
      active_project_count: openProjects.length,
      archived_project_count: workspaceProjects.length - openProjects.length,
      expense_count: workspaceExpenses.length,
      total_amount_cents: sumBy(workspaceExpenses, "amount_cents"),
      review_later_count: workspaceExpenses.filter((expense) => expense.record_treatment === "review_later").length,
      possible_improvement_total_cents: sumBy(
        workspaceExpenses.filter((expense) => expense.record_treatment === "possible_improvement"),
        "amount_cents"
      ),
      repair_upkeep_total_cents: sumBy(
        workspaceExpenses.filter((expense) => expense.record_treatment === "repair_upkeep"),
        "amount_cents"
      ),
      document_count: workspaceDocuments.length,
      with_file_count: documentFileStates.filter((state) => state.hasAvailableFile).length,
      missing_file_count: missingFileCount,
      ocr_text_available_count: documentFileStates.filter((state) => state.hasOcrText).length,
      ocr_pending_count: documentFileStates.filter((state) => state.hasPendingOcr).length,
      vendor_count: openVendors.length,
      projects_by_status: groupCount(workspaceProjects, "status").map(([status, count]) => ({ status, count })),
      expenses_by_classification: groupCount(workspaceExpenses, "record_treatment").map(([recordTreatment, count]) => ({
        record_treatment: recordTreatment,
        count,
        total_amount_cents: sumBy(
          workspaceExpenses.filter((expense) => expense.record_treatment === recordTreatment),
          "amount_cents"
        )
      })),
      documents_by_type: groupCount(workspaceDocuments, "document_type").map(([documentType, count]) => ({
        document_type: documentType,
        count
      })),
      recent_activity: recentActivityRows({
        properties: openProperties,
        projects: openProjects,
        expenses: workspaceExpenses,
        documents: workspaceDocuments
      }),
      follow_ups: [
        expenseSupportCount > 0 ? { type: "expense_support", label: "Expense support", count: expenseSupportCount } : null,
        missingFileCount > 0 ? { type: "missing_file", label: "Documents missing files", count: missingFileCount } : null,
        projectReviewCount > 0 ? { type: "needs_review", label: "Projects needing review", count: projectReviewCount } : null
      ].filter(Boolean)
    };
  }

  function recentActivityRows({ properties: activityProperties, projects: activityProjects, expenses: activityExpenses, documents: activityDocuments }) {
    return [
      ...activityProperties.map((property) => ({
        activity_type: "property",
        record_type: "property",
        record_id: property.id,
        record_name: property.name,
        summary: property.name,
        occurred_at: property.created_at,
        property_id: property.id,
        property_name: property.name
      })),
      ...activityProjects.map((project) => {
        const property = properties.get(project.property_id);
        return {
          activity_type: "project",
          record_type: "project",
          record_id: project.id,
          record_name: project.name,
          summary: project.name,
          occurred_at: project.created_at,
          property_id: project.property_id,
          property_name: property?.name || null,
          project_id: project.id,
          project_name: project.name,
          status: project.status
        };
      }),
      ...activityExpenses.map((expense) => {
        const property = properties.get(expense.property_id);
        const project = expense.project_id ? projects.get(expense.project_id) : null;
        return {
          activity_type: "expense",
          record_type: "expense",
          record_id: expense.id,
          record_name: expense.description,
          summary: expense.description,
          occurred_at: expense.created_at,
          property_id: expense.property_id,
          property_name: property?.name || null,
          project_id: expense.project_id,
          project_name: project?.name || null,
          expense_id: expense.id,
          amount_cents: expense.amount_cents,
          record_treatment: expense.record_treatment
        };
      }),
      ...activityDocuments.map((document) => {
        const property = properties.get(document.property_id);
        const project = document.project_id ? projects.get(document.project_id) : null;
        return {
          activity_type: "document",
          record_type: "document",
          record_id: document.id,
          record_name: document.display_name,
          summary: document.display_name,
          occurred_at: document.created_at,
          property_id: document.property_id,
          property_name: property?.name || null,
          project_id: document.project_id,
          project_name: project?.name || null,
          document_id: document.id,
          document_type: document.document_type,
          file_availability: document.file_availability
        };
      })
    ]
      .sort((left, right) => String(right.occurred_at).localeCompare(String(left.occurred_at)) || left.record_id.localeCompare(right.record_id))
      .slice(0, 10);
  }

  function groupCount(rows, field) {
    const counts = new Map();
    for (const row of rows) {
      counts.set(row[field], (counts.get(row[field]) || 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
  }

  function sumBy(rows, field) {
    return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  }

  function valueForSqlMarker(sql, params, columnName) {
    const match = new RegExp(`${escapeRegExp(columnName)} = \\$(\\d+)`).exec(sql);
    if (!match) {
      return "";
    }
    return params[Number(match[1]) - 1];
  }

  function valueForSqlComparison(sql, params, columnName, operator) {
    const match = new RegExp(`${escapeRegExp(columnName)} ${escapeRegExp(operator)} \\$(\\d+)`).exec(sql);
    if (!match) {
      return "";
    }
    return params[Number(match[1]) - 1];
  }

  return db;
}

export function createSeededWorkspaceState() {
  return {
    users: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        email: "owner@example.test",
        display_name: "Owner User"
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        email: "editor@example.test",
        display_name: "Editor User"
      },
      {
        id: "00000000-0000-4000-8000-000000000103",
        email: "viewer@example.test",
        display_name: "Viewer User"
      },
      {
        id: "00000000-0000-4000-8000-000000000104",
        email: "nonmember@example.test",
        display_name: "Nonmember User"
      }
    ],
    workspaces: [
      {
        id: WORKSPACE_IDS.owner,
        name: "Owner workspace"
      },
      {
        id: WORKSPACE_IDS.editor,
        name: "Editor workspace"
      },
      {
        id: WORKSPACE_IDS.viewer,
        name: "Viewer workspace"
      },
      {
        id: WORKSPACE_IDS.deleted,
        name: "Deleted workspace",
        status: "deleted",
        deleted_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: WORKSPACE_IDS.inactiveMembership,
        name: "Inactive membership workspace"
      }
    ],
    memberships: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        workspace_id: WORKSPACE_IDS.owner,
        user_id: "00000000-0000-4000-8000-000000000101",
        role: "owner"
      },
      {
        id: "00000000-0000-4000-8000-000000000202",
        workspace_id: WORKSPACE_IDS.editor,
        user_id: "00000000-0000-4000-8000-000000000102",
        role: "editor"
      },
      {
        id: "00000000-0000-4000-8000-000000000203",
        workspace_id: WORKSPACE_IDS.viewer,
        user_id: "00000000-0000-4000-8000-000000000103",
        role: "viewer"
      },
      {
        id: "00000000-0000-4000-8000-000000000204",
        workspace_id: WORKSPACE_IDS.deleted,
        user_id: "00000000-0000-4000-8000-000000000101",
        role: "owner"
      },
      {
        id: "00000000-0000-4000-8000-000000000205",
        workspace_id: WORKSPACE_IDS.inactiveMembership,
        user_id: "00000000-0000-4000-8000-000000000101",
        role: "owner",
        status: "disabled"
      }
    ],
    properties: [
      {
        id: PROPERTY_IDS.ownerPrimary,
        workspace_id: WORKSPACE_IDS.owner,
        name: "Office",
        display_address: "1124 Huminger Drive",
        purchase_date: "2020-01-15",
        purchase_price_cents: 20000000,
        is_primary: true
      },
      {
        id: PROPERTY_IDS.ownerSecondary,
        workspace_id: WORKSPACE_IDS.owner,
        name: "Lake house",
        display_address: "22 Lake Road",
        purchase_date: null,
        purchase_price_cents: null,
        is_primary: false
      },
      {
        id: PROPERTY_IDS.ownerArchived,
        workspace_id: WORKSPACE_IDS.owner,
        name: "Archived condo",
        archived_at: "2026-06-06T13:00:00.000Z",
        is_primary: false
      },
      {
        id: PROPERTY_IDS.editorPrimary,
        workspace_id: WORKSPACE_IDS.editor,
        name: "Editor property",
        is_primary: true
      },
      {
        id: PROPERTY_IDS.viewerPrimary,
        workspace_id: WORKSPACE_IDS.viewer,
        name: "Viewer property",
        is_primary: true
      }
    ],
    vendors: [
      {
        id: VENDOR_IDS.ownerPrimary,
        workspace_id: WORKSPACE_IDS.owner,
        name: "Cedarline Carpentry",
        normalized_name: "cedarline carpentry",
        category: "carpentry",
        contact_name: "Sam Cedar",
        phone: "555-0100",
        email: "sam@cedarline.example",
        website: "https://cedarline.example/",
        notes: "Preferred deck vendor",
        status: "active",
        source_confidence: "user_confirmed"
      },
      {
        id: VENDOR_IDS.ownerSecondary,
        workspace_id: WORKSPACE_IDS.owner,
        name: "Northside Painting Co.",
        normalized_name: "northside painting co.",
        category: "painting",
        status: "active",
        source_confidence: "explicit"
      },
      {
        id: VENDOR_IDS.ownerArchived,
        workspace_id: WORKSPACE_IDS.owner,
        name: "Archived Vendor",
        normalized_name: "archived vendor",
        status: "archived",
        archived_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: VENDOR_IDS.editorPrimary,
        workspace_id: WORKSPACE_IDS.editor,
        name: "Editor Vendor",
        normalized_name: "editor vendor",
        status: "active"
      },
      {
        id: VENDOR_IDS.viewerPrimary,
        workspace_id: WORKSPACE_IDS.viewer,
        name: "Viewer Vendor",
        normalized_name: "viewer vendor",
        status: "active"
      }
    ],
    projects: [
      {
        id: PROJECT_IDS.ownerDeck,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        vendor_id: VENDOR_IDS.ownerPrimary,
        name: "Deck repair and railing",
        category: "deck/patio/porch",
        status: "in_progress",
        start_date: "2026-06-01",
        completion_date: null,
        contractor_name_raw: "Cedarline Carpentry",
        permit_number: "PR-100",
        scope_summary: "Repair deck boards and railing.",
        notes: "Visible project note",
        updated_at: "2026-06-06T14:00:00.000Z"
      },
      {
        id: PROJECT_IDS.ownerKitchen,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerSecondary,
        vendor_id: VENDOR_IDS.ownerSecondary,
        name: "Kitchen painting",
        category: "painting",
        status: "completed",
        start_date: "2026-05-01",
        completion_date: "2026-05-07",
        scope_summary: "Paint kitchen walls.",
        updated_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: PROJECT_IDS.ownerArchived,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        vendor_id: null,
        name: "Archived project",
        category: "general",
        status: "archived",
        archived_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: PROJECT_IDS.editorProject,
        workspace_id: WORKSPACE_IDS.editor,
        property_id: PROPERTY_IDS.editorPrimary,
        vendor_id: VENDOR_IDS.editorPrimary,
        name: "Editor project",
        category: "general",
        status: "planned"
      },
      {
        id: PROJECT_IDS.viewerProject,
        workspace_id: WORKSPACE_IDS.viewer,
        property_id: PROPERTY_IDS.viewerPrimary,
        vendor_id: VENDOR_IDS.viewerPrimary,
        name: "Viewer project",
        category: "general",
        status: "planned"
      }
    ],
    expenses: [
      {
        id: EXPENSE_IDS.ownerDeckReceipt,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        project_id: PROJECT_IDS.ownerDeck,
        vendor_id: VENDOR_IDS.ownerPrimary,
        vendor_name_raw: "Cedarline Carpentry",
        expense_date: "2026-06-04",
        description: "Deck railing materials",
        amount_cents: 68000,
        category: "deck/patio/porch",
        record_treatment: "repair_upkeep",
        documentation_status: "receipt_attached",
        notes: "Receipt uploaded.",
        updated_at: "2026-06-06T15:00:00.000Z"
      },
      {
        id: EXPENSE_IDS.ownerKitchenInvoice,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerSecondary,
        project_id: PROJECT_IDS.ownerKitchen,
        vendor_id: VENDOR_IDS.ownerSecondary,
        vendor_name_raw: "Northside Painting Co.",
        expense_date: "2026-05-06",
        description: "Kitchen paint labor",
        amount_cents: 248000,
        category: "painting",
        record_treatment: "possible_improvement",
        documentation_status: "invoice_attached",
        notes: "Invoice attached.",
        updated_at: "2026-06-06T14:00:00.000Z"
      },
      {
        id: EXPENSE_IDS.ownerUnlinked,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        project_id: null,
        vendor_id: null,
        vendor_name_raw: "Cash vendor",
        expense_date: "2026-04-01",
        description: "Miscellaneous repair supplies",
        amount_cents: 1250,
        category: "general",
        record_treatment: "review_later",
        documentation_status: "needs_follow_up",
        notes: null,
        updated_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: EXPENSE_IDS.ownerDeleted,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        project_id: null,
        vendor_id: null,
        vendor_name_raw: "Deleted vendor",
        expense_date: "2026-03-01",
        description: "Deleted expense",
        amount_cents: 999,
        category: "general",
        record_treatment: "review_later",
        documentation_status: "no_document_yet",
        deleted_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: EXPENSE_IDS.editorExpense,
        workspace_id: WORKSPACE_IDS.editor,
        property_id: PROPERTY_IDS.editorPrimary,
        project_id: PROJECT_IDS.editorProject,
        vendor_id: VENDOR_IDS.editorPrimary,
        vendor_name_raw: "Editor Vendor",
        expense_date: "2026-06-01",
        description: "Editor expense",
        amount_cents: 5000,
        category: "general",
        record_treatment: "review_later",
        documentation_status: "no_document_yet"
      },
      {
        id: EXPENSE_IDS.viewerExpense,
        workspace_id: WORKSPACE_IDS.viewer,
        property_id: PROPERTY_IDS.viewerPrimary,
        project_id: PROJECT_IDS.viewerProject,
        vendor_id: VENDOR_IDS.viewerPrimary,
        vendor_name_raw: "Viewer Vendor",
        expense_date: "2026-06-02",
        description: "Viewer expense",
        amount_cents: 7500,
        category: "general",
        record_treatment: "review_later",
        documentation_status: "no_document_yet"
      }
    ],
    documents: [
      {
        id: DOCUMENT_IDS.ownerDeckReceipt,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        project_id: PROJECT_IDS.ownerDeck,
        expense_id: EXPENSE_IDS.ownerDeckReceipt,
        display_name: "Cedarline Carpentry - Receipt",
        document_type: "receipt",
        document_date: "2026-06-05",
        notes: "Receipt metadata only.",
        file_availability: "available",
        file_status_note: null,
        updated_at: "2026-06-06T15:00:00.000Z"
      },
      {
        id: DOCUMENT_IDS.ownerKitchenInvoice,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerSecondary,
        project_id: PROJECT_IDS.ownerKitchen,
        expense_id: EXPENSE_IDS.ownerKitchenInvoice,
        display_name: "Northside Painting Co. - Invoice",
        document_type: "invoice",
        document_date: "2026-05-07",
        notes: "Invoice metadata only.",
        file_availability: "not_uploaded",
        file_status_note: "File not uploaded yet.",
        updated_at: "2026-06-06T14:00:00.000Z"
      },
      {
        id: DOCUMENT_IDS.ownerUnlinkedPermit,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        project_id: null,
        expense_id: null,
        display_name: "Deck permit",
        document_type: "permit",
        document_date: "2026-04-15",
        notes: null,
        file_availability: "missing",
        file_status_note: "Imported without file content.",
        updated_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: DOCUMENT_IDS.ownerDeleted,
        workspace_id: WORKSPACE_IDS.owner,
        property_id: PROPERTY_IDS.ownerPrimary,
        project_id: null,
        expense_id: null,
        display_name: "Deleted document",
        document_type: "other",
        document_date: "2026-03-01",
        file_availability: "not_uploaded",
        deleted_at: "2026-06-06T13:00:00.000Z"
      },
      {
        id: DOCUMENT_IDS.editorDocument,
        workspace_id: WORKSPACE_IDS.editor,
        property_id: PROPERTY_IDS.editorPrimary,
        project_id: PROJECT_IDS.editorProject,
        expense_id: EXPENSE_IDS.editorExpense,
        display_name: "Editor document",
        document_type: "receipt",
        document_date: "2026-06-01",
        file_availability: "not_uploaded"
      },
      {
        id: DOCUMENT_IDS.viewerDocument,
        workspace_id: WORKSPACE_IDS.viewer,
        property_id: PROPERTY_IDS.viewerPrimary,
        project_id: PROJECT_IDS.viewerProject,
        expense_id: EXPENSE_IDS.viewerExpense,
        display_name: "Viewer document",
        document_type: "receipt",
        document_date: "2026-06-02",
        file_availability: "not_uploaded"
      }
    ],
    documentFiles: [
      {
        id: DOCUMENT_FILE_IDS.ownerDeckReceipt,
        workspace_id: WORKSPACE_IDS.owner,
        document_id: DOCUMENT_IDS.ownerDeckReceipt,
        storage_provider: "test",
        storage_key: "private/owner-deck-receipt.pdf",
        original_file_name: "cedarline-receipt.pdf",
        mime_type: "application/pdf",
        size_bytes: 2048,
        sha256: null,
        source: "web_upload",
        status: "available",
        uploaded_at: "2026-06-06T15:00:00.000Z"
      },
      {
        id: DOCUMENT_FILE_IDS.editorDocument,
        workspace_id: WORKSPACE_IDS.editor,
        document_id: DOCUMENT_IDS.editorDocument,
        storage_provider: "test",
        storage_key: "private/editor-receipt.pdf",
        original_file_name: "editor-receipt.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        sha256: null,
        source: "web_upload",
        status: "available",
        uploaded_at: "2026-06-06T12:00:00.000Z"
      },
      {
        id: DOCUMENT_FILE_IDS.viewerDocument,
        workspace_id: WORKSPACE_IDS.viewer,
        document_id: DOCUMENT_IDS.viewerDocument,
        storage_provider: "test",
        storage_key: "private/viewer-receipt.pdf",
        original_file_name: "viewer-receipt.pdf",
        mime_type: "application/pdf",
        size_bytes: 4096,
        sha256: null,
        source: "web_upload",
        status: "available",
        uploaded_at: "2026-06-06T12:00:00.000Z"
      }
    ]
  };
}

function makeUuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function normalizeSql(sql) {
  return String(sql || "").trim().toUpperCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
