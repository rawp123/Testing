import pg from "pg";

export function createDatabasePool(config) {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax
  });
}

export async function closeDatabasePool(db) {
  if (db && typeof db.end === "function") {
    await db.end();
  }
}
