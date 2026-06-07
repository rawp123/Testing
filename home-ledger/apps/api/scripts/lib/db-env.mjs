export function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for migration commands.");
  }
  return databaseUrl;
}

export function requireTestDatabaseUrl() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required. Refusing to run schema checks against DATABASE_URL.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && normalizeUrl(databaseUrl) === normalizeUrl(testDatabaseUrl)) {
    throw new Error("TEST_DATABASE_URL must not match DATABASE_URL.");
  }

  const parsed = new URL(testDatabaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!/test/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL database name must include 'test'.");
  }

  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  if (/^(production|prod|staging)$/i.test(appEnv)) {
    throw new Error(`Refusing to run test database command in ${appEnv}.`);
  }

  return testDatabaseUrl;
}

function normalizeUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}
