/**
 * Agent OS — Database Connection
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgresql://localhost:5432/agent_os";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export { schema };
