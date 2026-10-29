// Regenerates the database types from the live schema, for both the API and the website.
// Run with: npm run db:types (reads SUPABASE_DB_URL from server/.env; never prints it).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL in server/.env");
  process.exit(1);
}
const types = execFileSync("npx", ["supabase", "gen", "types", "typescript", "--db-url", dbUrl, "--schema", "public"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
for (const path of ["server/src/supabase/database.types.ts", "lib/supabase/database.types.ts"]) {
  writeFileSync(path, types);
  console.log(`Wrote ${path}`);
}
// The API checks its formatting with Prettier, so keep its copy formatted.
execFileSync("npx", ["prettier", "--write", "src/supabase/database.types.ts"], { cwd: "server", stdio: "ignore" });
