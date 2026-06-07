import { buildApp } from "./app.js";
import { formatConfigError, loadConfig } from "./config.js";
import { closeDatabasePool, createDatabasePool } from "./db.js";

let db;

try {
  const config = loadConfig();
  db = createDatabasePool(config);
  const app = buildApp({ config, db, logger: true });

  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info({ address, appEnv: config.appEnv }, "Home Ledger API listening");

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      app.log.info({ signal }, "Stopping Home Ledger API");
      await app.close();
      await closeDatabasePool(db);
      process.exit(0);
    });
  }
} catch (error) {
  if (error && error.name === "ConfigError") {
    console.error(formatConfigError(error));
  } else {
    console.error("API failed to start.");
  }
  await closeDatabasePool(db);
  process.exit(1);
}
