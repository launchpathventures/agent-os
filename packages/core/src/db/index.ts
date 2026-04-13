/**
 * @ditto/core — Database Layer
 *
 * Injectable database pattern. The core package defines the schema but
 * does NOT create a database connection. The consuming application
 * creates the connection and passes it to the engine via createEngine().
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export { schema };
export * from "./schema.js";
export * from "./schema-process-models.js";

/**
 * The database type used throughout @ditto/core.
 * Consumers create an instance of this and pass it to the engine.
 */
export type CoreDatabase = BetterSQLite3Database<typeof schema>;
