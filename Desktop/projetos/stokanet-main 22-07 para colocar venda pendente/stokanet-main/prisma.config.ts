import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./lib/database-url";

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  throw new Error("DATABASE_URL, TURSO_DATABASE_URL, LIBSQL_URL or DIRECT_URL is not set");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
