import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local"))
  throw new Error(".env.local already exists; preserve your configuration.");
const status = JSON.parse(
  execSync("supabase status --output json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!status.API_URL || !publicKey || !status.SERVICE_ROLE_KEY)
  throw new Error("Local Supabase must be running.");
const url = new URL(status.API_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Only local Supabase is supported.");
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publicKey}\nSUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\nSENTRY_DSN=\n`,
  { mode: 0o600 },
);
console.log(
  "Created ignored .env.local for local Supabase. Credentials were not printed.",
);
