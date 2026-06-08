import { loadConfig, formatConfigError } from "../src/config.js";
import { closeDatabasePool, createDatabasePool } from "../src/db.js";
import { getReadinessSnapshot } from "../src/readiness.js";

let db;

try {
  const config = loadConfig();
  db = createDatabasePool(config);
  const snapshot = await getReadinessSnapshot({ config, db });

  console.log(`Home Ledger API readiness: ${snapshot.status}`);
  for (const check of snapshot.checks) {
    console.log(`- ${check.name}: ${check.status} - ${check.message}`);
  }

  process.exitCode = snapshot.status === "ready" ? 0 : 1;
} catch (error) {
  if (error && error.name === "ConfigError") {
    console.error(formatConfigError(error));
  } else {
    console.error("API readiness check failed.");
  }
  process.exitCode = 1;
} finally {
  await closeDatabasePool(db);
}
