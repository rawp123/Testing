import { fileURLToPath } from "node:url";
import { loadConfig, formatConfigError } from "../src/config.js";
import { closeDatabasePool, createDatabasePool } from "../src/db.js";
import { getReadinessSnapshot } from "../src/readiness.js";

export function formatReadinessSnapshot(snapshot) {
  return [
    `Home Ledger API readiness: ${snapshot.status}`,
    ...snapshot.checks.map((check) => `- ${check.name}: ${check.status} - ${check.message}`)
  ].join("\n");
}

async function main() {
  let db;

  try {
    const config = loadConfig();
    db = createDatabasePool(config);
    const snapshot = await getReadinessSnapshot({ config, db });

    console.log(formatReadinessSnapshot(snapshot));

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
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
