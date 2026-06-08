import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { requireWorkspaceMembership, requireWorkspaceOwner, requireWorkspaceRole } from "./authorization.js";
import { resolveAuthenticatedRequest, serializeSession } from "./auth.js";
import { apiError, createErrorEnvelope, isApiError, isValidationError, sendError } from "./errors.js";
import {
  createDocument,
  createDocumentFileIntent,
  deleteDocument,
  deleteDocumentFile,
  completeDocumentFileUpload,
  getDocumentById,
  getDocumentFileDownload,
  getDocumentFilterOptions,
  getDocumentOcrStatus,
  getDocumentOcrText,
  listDocuments,
  requestDocumentOcr,
  serializeDocument,
  serializeDocumentOcr,
  serializeDocumentOcrText,
  updateDocument
} from "./documents.js";
import { getDashboardSummary, serializeDashboardSummary } from "./dashboard.js";
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenseFilterOptions,
  listExpenses,
  serializeExpense,
  updateExpense
} from "./expenses.js";
import {
  buildDocumentsCsv,
  buildExpensesCsv,
  buildExportSummary,
  buildFullJsonExport,
  exportFilename,
  getExportData,
  setCsvResponseHeaders,
  setJsonExportHeaders
} from "./exports.js";
import {
  addOpenItemCounts,
  getFollowUpSummary,
  listFollowUps,
  reopenFollowUp,
  resolveFollowUp,
  serializeFollowUp
} from "./follow-ups.js";
import { createFileStorageAdapter } from "./file-storage.js";
import { createOcrProvider } from "./ocr-provider.js";
import {
  archiveProperty,
  createProperty,
  getPropertyById,
  listProperties,
  serializeProperty,
  updateProperty
} from "./properties.js";
import {
  archiveProject,
  createProject,
  getProjectById,
  getProjectFilterOptions,
  listProjects,
  serializeProject,
  updateProject
} from "./projects.js";
import {
  archiveVendor,
  createVendor,
  getVendorById,
  listVendors,
  serializeVendor,
  updateVendor
} from "./vendors.js";
import { getReadinessSnapshot, serializeReadinessSnapshot } from "./readiness.js";
import {
  WorkspaceValidationError,
  createWorkspaceWithOwner,
  listUserWorkspaces,
  serializeWorkspace,
  updateWorkspaceBasics
} from "./workspaces.js";

export function buildApp({ config, db, logger = false, fileStorage, ocrProvider } = {}) {
  const storage = fileStorage || createFileStorageAdapter({
    driver: config.fileStorageDriver,
    config: config.fileStorage
  });
  const ocr = ocrProvider || createOcrProvider({ mode: config.ocrMode });
  const app = Fastify({
    logger,
    genReqId: (request) => {
      const headerName = config.requestIdHeader.toLowerCase();
      const requestId = request.headers[headerName];
      if (typeof requestId === "string" && requestId.trim()) {
        return requestId.slice(0, 128);
      }
      return `req_${randomUUID()}`;
    }
  });

  app.decorateRequest("auth", null);

  app.decorate("authenticate", async (request, reply) => {
    request.auth = await resolveAuthenticatedRequest({ request, config, db });
    if (!request.auth) {
      return sendError(reply, 401, {
        code: "unauthenticated",
        message: "Sign in required.",
        requestId: request.id
      });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) {
      return;
    }

    if (isApiError(error)) {
      return sendError(reply, error.statusCode, {
        code: error.code,
        message: error.message,
        requestId: request.id,
        details: error.details
      });
    }

    if (isValidationError(error)) {
      return sendError(reply, 422, {
        code: "validation_failed",
        message: error.message,
        requestId: request.id,
        details: error.details
      });
    }

    if (error instanceof WorkspaceValidationError) {
      return sendError(reply, 422, {
        code: "validation_failed",
        message: "Fix the highlighted fields.",
        requestId: request.id,
        details: [
          {
            field: error.field,
            issue: error.issue
          }
        ]
      });
    }

    request.log.error({ error }, "Unhandled API error");
    reply.code(500).send(createErrorEnvelope({
      code: "internal_error",
      message: "Something went wrong.",
      requestId: request.id
    }));
  });

  app.get("/health", async () => ({
    data: {
      status: "ok"
    }
  }));

  app.get("/ready", async (request, reply) => {
    const snapshot = await getReadinessSnapshot({ config, db });
    if (snapshot.status !== "ready") {
      reply.code(503);
    }

    return {
      data: serializeReadinessSnapshot(snapshot)
    };
  });

  app.register(async (api) => {
    api.get("/session", { preHandler: app.authenticate }, async (request) => {
      return serializeSession(request.auth);
    });

    api.get("/workspaces", { preHandler: app.authenticate }, async (request) => {
      const workspaces = await listUserWorkspaces({
        db,
        userId: request.auth.userId
      });

      return {
        data: workspaces.map(serializeWorkspace)
      };
    });

    api.post("/workspaces", { preHandler: app.authenticate }, async (request, reply) => {
      const workspace = await createWorkspaceWithOwner({
        db,
        userId: request.auth.userId,
        name: request.body?.name
      });

      return reply.code(201).send({
        data: serializeWorkspace(workspace)
      });
    });

    api.get("/workspaces/:workspaceId", { preHandler: app.authenticate }, async (request) => {
      const workspace = await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      return {
        data: serializeWorkspace(workspace)
      };
    });

    api.patch("/workspaces/:workspaceId", { preHandler: app.authenticate }, async (request) => {
      const membership = await requireWorkspaceOwner({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const workspace = await updateWorkspaceBasics({
        db,
        workspaceId: request.params.workspaceId,
        name: request.body?.name
      });

      if (!workspace) {
        throw apiError(404, "not_found", "Workspace not found.");
      }

      return {
        data: serializeWorkspace({
          ...workspace,
          role: membership.role
        })
      };
    });

    api.get("/workspaces/:workspaceId/dashboard", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const summary = await getDashboardSummary({
        db,
        workspaceId: request.params.workspaceId
      });
      const followUpSummary = await getFollowUpSummary({
        db,
        workspaceId: request.params.workspaceId
      });
      summary.projects.open_follow_up_count = followUpSummary.open_count;
      summary.followUps = followUpSummary.by_type;

      return {
        data: serializeDashboardSummary(summary)
      };
    });

    api.get("/workspaces/:workspaceId/follow-ups", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const followUps = await listFollowUps({
        db,
        workspaceId: request.params.workspaceId,
        status: request.query?.status || "open"
      });

      return {
        data: followUps.map(serializeFollowUp)
      };
    });

    api.get("/workspaces/:workspaceId/follow-ups/summary", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      return {
        data: await getFollowUpSummary({
          db,
          workspaceId: request.params.workspaceId
        })
      };
    });

    api.post("/workspaces/:workspaceId/follow-ups/:followUpId/resolve", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const followUp = await resolveFollowUp({
        db,
        workspaceId: request.params.workspaceId,
        followUpId: request.params.followUpId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      return {
        data: serializeFollowUp(followUp)
      };
    });

    api.post("/workspaces/:workspaceId/follow-ups/:followUpId/reopen", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const followUp = await reopenFollowUp({
        db,
        workspaceId: request.params.workspaceId,
        followUpId: request.params.followUpId,
        input: request.body
      });

      return {
        data: serializeFollowUp(followUp)
      };
    });

    api.get("/workspaces/:workspaceId/exports/summary", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const exportData = await getExportData({
        db,
        workspaceId: request.params.workspaceId
      });

      return {
        data: buildExportSummary(exportData)
      };
    });

    api.get("/workspaces/:workspaceId/exports/expenses.csv", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const exportData = await getExportData({
        db,
        workspaceId: request.params.workspaceId
      });
      setCsvResponseHeaders(reply, exportFilename("expenses", "csv"));
      return reply.send(buildExpensesCsv(exportData));
    });

    api.get("/workspaces/:workspaceId/exports/documents.csv", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const exportData = await getExportData({
        db,
        workspaceId: request.params.workspaceId
      });
      setCsvResponseHeaders(reply, exportFilename("documents", "csv"));
      return reply.send(buildDocumentsCsv(exportData));
    });

    api.get("/workspaces/:workspaceId/exports/full.json", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const exportData = await getExportData({
        db,
        workspaceId: request.params.workspaceId
      });
      setJsonExportHeaders(reply, exportFilename("full", "json"));
      return {
        data: buildFullJsonExport(exportData)
      };
    });

    api.get("/workspaces/:workspaceId/properties", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const result = await listProperties({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {},
        pagination: request.query || {},
        sort: request.query?.sort
      });

      return {
        data: result.data.map(serializeProperty),
        meta: result.meta
      };
    });

    api.post("/workspaces/:workspaceId/properties", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const property = await createProperty({
        db,
        workspaceId: request.params.workspaceId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      return reply.code(201).send({
        data: serializeProperty(property)
      });
    });

    api.get("/workspaces/:workspaceId/properties/:propertyId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const property = await getPropertyById({
        db,
        workspaceId: request.params.workspaceId,
        propertyId: request.params.propertyId
      });

      if (!property) {
        throw apiError(404, "not_found", "Property not found.");
      }

      return {
        data: serializeProperty(property)
      };
    });

    api.patch("/workspaces/:workspaceId/properties/:propertyId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const property = await updateProperty({
        db,
        workspaceId: request.params.workspaceId,
        propertyId: request.params.propertyId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!property) {
        throw apiError(404, "not_found", "Property not found.");
      }

      return {
        data: serializeProperty(property)
      };
    });

    api.post("/workspaces/:workspaceId/properties/:propertyId/archive", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const property = await archiveProperty({
        db,
        workspaceId: request.params.workspaceId,
        propertyId: request.params.propertyId,
        actorUserId: request.auth.userId
      });

      if (!property) {
        throw apiError(404, "not_found", "Property not found.");
      }

      return {
        data: serializeProperty(property)
      };
    });

    api.delete("/workspaces/:workspaceId/properties/:propertyId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const property = await archiveProperty({
        db,
        workspaceId: request.params.workspaceId,
        propertyId: request.params.propertyId,
        actorUserId: request.auth.userId
      });

      if (!property) {
        throw apiError(404, "not_found", "Property not found.");
      }

      return {
        data: serializeProperty(property)
      };
    });

    api.get("/workspaces/:workspaceId/vendors", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const result = await listVendors({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {},
        pagination: request.query || {},
        sort: request.query?.sort
      });

      return {
        data: result.data.map(serializeVendor),
        meta: result.meta
      };
    });

    api.post("/workspaces/:workspaceId/vendors", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const vendor = await createVendor({
        db,
        workspaceId: request.params.workspaceId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      return reply.code(201).send({
        data: serializeVendor(vendor)
      });
    });

    api.get("/workspaces/:workspaceId/vendors/:vendorId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const vendor = await getVendorById({
        db,
        workspaceId: request.params.workspaceId,
        vendorId: request.params.vendorId
      });

      if (!vendor) {
        throw apiError(404, "not_found", "Vendor not found.");
      }

      return {
        data: serializeVendor(vendor)
      };
    });

    api.patch("/workspaces/:workspaceId/vendors/:vendorId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const vendor = await updateVendor({
        db,
        workspaceId: request.params.workspaceId,
        vendorId: request.params.vendorId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!vendor) {
        throw apiError(404, "not_found", "Vendor not found.");
      }

      return {
        data: serializeVendor(vendor)
      };
    });

    api.post("/workspaces/:workspaceId/vendors/:vendorId/archive", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const vendor = await archiveVendor({
        db,
        workspaceId: request.params.workspaceId,
        vendorId: request.params.vendorId,
        actorUserId: request.auth.userId
      });

      if (!vendor) {
        throw apiError(404, "not_found", "Vendor not found.");
      }

      return {
        data: serializeVendor(vendor)
      };
    });

    api.delete("/workspaces/:workspaceId/vendors/:vendorId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const vendor = await archiveVendor({
        db,
        workspaceId: request.params.workspaceId,
        vendorId: request.params.vendorId,
        actorUserId: request.auth.userId
      });

      if (!vendor) {
        throw apiError(404, "not_found", "Vendor not found.");
      }

      return {
        data: serializeVendor(vendor)
      };
    });

    api.get("/workspaces/:workspaceId/projects", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const result = await listProjects({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {},
        pagination: request.query || {},
        sort: request.query?.sort
      });
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        projects: result.data
      });

      return {
        data: counted.projects.map(serializeProject),
        meta: result.meta
      };
    });

    api.post("/workspaces/:workspaceId/projects", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const project = await createProject({
        db,
        workspaceId: request.params.workspaceId,
        input: request.body,
        actorUserId: request.auth.userId
      });
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        projects: [project]
      });

      return reply.code(201).send({
        data: serializeProject(counted.projects[0])
      });
    });

    api.get("/workspaces/:workspaceId/projects/filter-options", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const options = await getProjectFilterOptions({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {}
      });

      return {
        data: options
      };
    });

    api.get("/workspaces/:workspaceId/projects/:projectId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const project = await getProjectById({
        db,
        workspaceId: request.params.workspaceId,
        projectId: request.params.projectId
      });

      if (!project) {
        throw apiError(404, "not_found", "Project not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        projects: [project]
      });

      return {
        data: serializeProject(counted.projects[0])
      };
    });

    api.patch("/workspaces/:workspaceId/projects/:projectId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const project = await updateProject({
        db,
        workspaceId: request.params.workspaceId,
        projectId: request.params.projectId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!project) {
        throw apiError(404, "not_found", "Project not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        projects: [project]
      });

      return {
        data: serializeProject(counted.projects[0])
      };
    });

    api.post("/workspaces/:workspaceId/projects/:projectId/archive", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const project = await archiveProject({
        db,
        workspaceId: request.params.workspaceId,
        projectId: request.params.projectId,
        actorUserId: request.auth.userId
      });

      if (!project) {
        throw apiError(404, "not_found", "Project not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        projects: [project]
      });

      return {
        data: serializeProject(counted.projects[0])
      };
    });

    api.delete("/workspaces/:workspaceId/projects/:projectId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const project = await archiveProject({
        db,
        workspaceId: request.params.workspaceId,
        projectId: request.params.projectId,
        actorUserId: request.auth.userId
      });

      if (!project) {
        throw apiError(404, "not_found", "Project not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        projects: [project]
      });

      return {
        data: serializeProject(counted.projects[0])
      };
    });

    api.get("/workspaces/:workspaceId/expenses", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const result = await listExpenses({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {},
        pagination: request.query || {},
        sort: request.query?.sort
      });
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        expenses: result.data
      });

      return {
        data: counted.expenses.map(serializeExpense),
        meta: result.meta
      };
    });

    api.post("/workspaces/:workspaceId/expenses", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const expense = await createExpense({
        db,
        workspaceId: request.params.workspaceId,
        input: request.body,
        actorUserId: request.auth.userId
      });
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        expenses: [expense]
      });

      return reply.code(201).send({
        data: serializeExpense(counted.expenses[0])
      });
    });

    api.get("/workspaces/:workspaceId/expenses/filter-options", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const options = await getExpenseFilterOptions({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {}
      });

      return {
        data: options
      };
    });

    api.get("/workspaces/:workspaceId/expenses/:expenseId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const expense = await getExpenseById({
        db,
        workspaceId: request.params.workspaceId,
        expenseId: request.params.expenseId
      });

      if (!expense) {
        throw apiError(404, "not_found", "Expense not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        expenses: [expense]
      });

      return {
        data: serializeExpense(counted.expenses[0])
      };
    });

    api.patch("/workspaces/:workspaceId/expenses/:expenseId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const expense = await updateExpense({
        db,
        workspaceId: request.params.workspaceId,
        expenseId: request.params.expenseId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!expense) {
        throw apiError(404, "not_found", "Expense not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        expenses: [expense]
      });

      return {
        data: serializeExpense(counted.expenses[0])
      };
    });

    api.delete("/workspaces/:workspaceId/expenses/:expenseId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const expense = await deleteExpense({
        db,
        workspaceId: request.params.workspaceId,
        expenseId: request.params.expenseId,
        actorUserId: request.auth.userId
      });

      if (!expense) {
        throw apiError(404, "not_found", "Expense not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        expenses: [expense]
      });

      return {
        data: serializeExpense(counted.expenses[0])
      };
    });

    api.get("/workspaces/:workspaceId/documents", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const result = await listDocuments({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {},
        pagination: request.query || {},
        sort: request.query?.sort
      });
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        documents: result.data
      });

      return {
        data: counted.documents.map(serializeDocument),
        meta: result.meta
      };
    });

    api.post("/workspaces/:workspaceId/documents", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const document = await createDocument({
        db,
        workspaceId: request.params.workspaceId,
        input: request.body,
        actorUserId: request.auth.userId
      });
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        documents: [document]
      });

      return reply.code(201).send({
        data: serializeDocument(counted.documents[0])
      });
    });

    api.get("/workspaces/:workspaceId/documents/filter-options", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const options = await getDocumentFilterOptions({
        db,
        workspaceId: request.params.workspaceId,
        filters: request.query || {}
      });

      return {
        data: options
      };
    });

    api.get("/workspaces/:workspaceId/documents/:documentId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const document = await getDocumentById({
        db,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId
      });

      if (!document) {
        throw apiError(404, "not_found", "Document not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        documents: [document]
      });

      return {
        data: serializeDocument(counted.documents[0])
      };
    });

    api.post("/workspaces/:workspaceId/documents/:documentId/file-intent", { preHandler: app.authenticate }, async (request, reply) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const intent = await createDocumentFileIntent({
        db,
        storage,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!intent) {
        throw apiError(404, "not_found", "Document not found.");
      }

      return reply.code(201).send({
        data: intent
      });
    });

    api.post("/workspaces/:workspaceId/documents/:documentId/file-complete", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const file = await completeDocumentFileUpload({
        db,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!file) {
        throw apiError(404, "not_found", "Document file not found.");
      }

      return {
        data: file
      };
    });

    api.get("/workspaces/:workspaceId/documents/:documentId/file", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const file = await getDocumentFileDownload({
        db,
        storage,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId
      });

      if (!file) {
        throw apiError(404, "not_found", "Document not found.");
      }

      return {
        data: file
      };
    });

    api.delete("/workspaces/:workspaceId/documents/:documentId/file", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const file = await deleteDocumentFile({
        db,
        storage,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId,
        actorUserId: request.auth.userId
      });

      if (!file) {
        throw apiError(404, "not_found", "Document not found.");
      }

      return {
        data: file
      };
    });

    api.post("/workspaces/:workspaceId/documents/:documentId/ocr", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const ocrStatus = await requestDocumentOcr({
        db,
        ocrProvider: ocr,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId
      });

      if (!ocrStatus) {
        throw apiError(404, "not_found", "Document not found.");
      }

      return {
        data: serializeDocumentOcr(ocrStatus)
      };
    });

    api.get("/workspaces/:workspaceId/documents/:documentId/ocr", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const ocrStatus = await getDocumentOcrStatus({
        db,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId
      });

      if (!ocrStatus) {
        throw apiError(404, "not_found", "Document not found.");
      }

      return {
        data: serializeDocumentOcr(ocrStatus)
      };
    });

    api.get("/workspaces/:workspaceId/documents/:documentId/text", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceMembership({
        request,
        db,
        workspaceId: request.params.workspaceId
      });

      const ocrText = await getDocumentOcrText({
        db,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId
      });

      if (!ocrText) {
        throw apiError(404, "not_found", "Document not found.");
      }

      return {
        data: serializeDocumentOcrText(ocrText)
      };
    });

    api.patch("/workspaces/:workspaceId/documents/:documentId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const document = await updateDocument({
        db,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId,
        input: request.body,
        actorUserId: request.auth.userId
      });

      if (!document) {
        throw apiError(404, "not_found", "Document not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        documents: [document]
      });

      return {
        data: serializeDocument(counted.documents[0])
      };
    });

    api.delete("/workspaces/:workspaceId/documents/:documentId", { preHandler: app.authenticate }, async (request) => {
      await requireWorkspaceRole({
        request,
        db,
        workspaceId: request.params.workspaceId,
        allowedRoles: ["owner", "editor"]
      });

      const document = await deleteDocument({
        db,
        workspaceId: request.params.workspaceId,
        documentId: request.params.documentId,
        actorUserId: request.auth.userId
      });

      if (!document) {
        throw apiError(404, "not_found", "Document not found.");
      }
      const counted = await addOpenItemCounts({
        db,
        workspaceId: request.params.workspaceId,
        documents: [document]
      });

      return {
        data: serializeDocument(counted.documents[0])
      };
    });
  }, { prefix: "/api/v1" });

  return app;
}
