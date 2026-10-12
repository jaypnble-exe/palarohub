import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Standard CLI authentication, isolated from other projects' saved profiles.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const linkedRef = join(root, "supabase/.temp/project-ref");
if (!args.length) throw new Error("Provide a Supabase Cloud command.");
if (
  args[0] !== "login" &&
  args[0] !== "projects" &&
  args[0] !== "link" &&
  existsSync(linkedRef) &&
  readFileSync(linkedRef, "utf8").trim() !== "ttmbymzlmfjrfgiyxdiy"
)
  throw new Error("This checkout is linked to a different Supabase project.");
const authHome = join(root, ".tmp/supabase-cli");
mkdirSync(authHome, { recursive: true });
let executable = "supabase";
let prefix = [];
if (process.platform === "win32") {
  executable = undefined;
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    const dir = directory.replace(/^"|"$/g, "");
    if (existsSync(join(dir, "supabase.exe"))) {
      executable = join(dir, "supabase.exe");
      break;
    }
    const launcher = join(dir, "node_modules/supabase/dist/supabase.js");
    if (existsSync(join(dir, "supabase.cmd")) && existsSync(launcher)) {
      executable = process.execPath;
      prefix = [launcher];
      break;
    }
  }
  if (!executable)
    throw new Error(
      "Install the Supabase CLI with npm or Scoop before running cloud commands.",
    );
}
const result = spawnSync(
  executable,
  [
    ...prefix,
    ...args,
    "--profile",
    join(root, "config/cloud/cli-profile.yaml"),
    "--workdir",
    root,
  ],
  {
    cwd: root,
    env: { ...process.env, SUPABASE_HOME: authHome },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
