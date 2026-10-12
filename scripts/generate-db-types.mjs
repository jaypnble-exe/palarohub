import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";

const target = process.argv[2] ?? "local";
if (!["local", "linked"].includes(target))
  throw new Error("Use local or linked as the type-generation target.");
const options = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
};
const types =
  target === "linked"
    ? execFileSync(
        process.execPath,
        [
          "scripts/supabase-cloud.mjs",
          "gen",
          "types",
          "typescript",
          "--linked",
        ],
        options,
      )
    : execSync("supabase gen types typescript --local", options);
mkdirSync("src/lib/supabase", { recursive: true });
writeFileSync(
  "src/lib/supabase/database.types.ts",
  await format(types, { parser: "typescript" }),
);
console.log(`Regenerated Supabase types from the ${target} database.`);
