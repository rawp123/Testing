export class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends Error {
  constructor(details, message = "Fix the highlighted fields.") {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export function isApiError(error) {
  return error instanceof ApiError;
}

export function isValidationError(error) {
  return error instanceof ValidationError;
}

export function apiError(statusCode, code, message, details) {
  return new ApiError(statusCode, code, message, details);
}

export function validationError(details, message) {
  return new ValidationError(details, message);
}

export function createErrorEnvelope({ code, message, requestId, details }) {
  const error = {
    code,
    message,
    requestId
  };

  if (details && details.length > 0) {
    error.details = details;
  }

  return { error };
}

export function sendError(reply, statusCode, { code, message, requestId, details }) {
  return reply
    .code(statusCode)
    .send(createErrorEnvelope({ code, message, requestId, details }));
}
