export function getAuthReadiness(config) {
  const authProvider = normalizeAuthProvider(config?.authProvider);
  const localLike = isLocalLikeEnv(config?.appEnv);

  if (authProvider === "dev") {
    if (localLike && config?.devAuthEnabled) {
      return {
        name: "auth",
        status: "local_only",
        message: "Auth is using local/test behavior."
      };
    }

    return {
      name: "auth",
      status: "not_ready",
      message: "Development auth is unavailable outside local/test mode."
    };
  }

  if (authProvider === "none") {
    return {
      name: "auth",
      status: "not_ready",
      message: "Production auth provider is not connected."
    };
  }

  return {
    name: "auth",
    status: "not_ready",
    message: "Production auth adapter is not implemented."
  };
}

export function normalizeAuthProvider(value) {
  const normalized = String(value || "none").trim().toLowerCase();
  return normalized || "none";
}

function isLocalLikeEnv(appEnv) {
  return appEnv === "local" || appEnv === "test";
}
