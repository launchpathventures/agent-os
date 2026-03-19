/**
 * Agent OS — Database Connection (SQLite via better-sqlite3)
 *
 * Zero-setup: auto-creates data/ directory and DB file on first run.
 * WAL mode for performance (antfarm pattern).
 *
 * Provenance: antfarm /src/db.ts (SQLite + WAL + auto-create)
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "agent-os.db");

// Auto-create data directory
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export { schema };
