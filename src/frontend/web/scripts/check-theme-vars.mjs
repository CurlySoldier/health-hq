import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");

const stylesPath = path.join(webRoot, "src", "styles.css");
const manifestPath = path.join(webRoot, "public", "themes", "themes.json");

const cssVarUsageRegex = /var\(--([a-z0-9-]+)(?:\s*,[^)]*)?\)/g;
const cssVarDefinitionRegex = /--([a-z0-9-]+)\s*:/g;

function collectMatches(content, regex) {
  const values = new Set();
  for (const match of content.matchAll(regex)) {
    values.add(match[1]);
  }
  return values;
}

function toSortedArray(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

async function main() {
  const stylesContent = await readFile(stylesPath, "utf8");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  const usedVars = collectMatches(stylesContent, cssVarUsageRegex);
  const fallbackVars = collectMatches(stylesContent, cssVarDefinitionRegex);
  const themeEntries = Array.isArray(manifest.themes) ? manifest.themes : [];

  if (themeEntries.length === 0) {
    throw new Error(`No themes declared in ${manifestPath}`);
  }

  const issues = [];

  for (const theme of themeEntries) {
    const cssFile = typeof theme.cssFile === "string" ? theme.cssFile : "";
    if (!cssFile.startsWith("/")) {
      issues.push(`Theme '${theme.id ?? "unknown"}' has invalid cssFile '${cssFile}'`);
      continue;
    }

    const themePath = path.join(webRoot, "public", cssFile.slice(1));
    const themeCss = await readFile(themePath, "utf8");
    const definedVars = collectMatches(themeCss, cssVarDefinitionRegex);
    const missing = toSortedArray(new Set([...usedVars].filter((name) => !definedVars.has(name))));

    if (missing.length > 0) {
      issues.push(`Theme '${theme.id ?? "unknown"}' is missing ${missing.length} var(s): ${missing.join(", ")}`);
    }
  }

  const missingFallback = toSortedArray(new Set([...usedVars].filter((name) => !fallbackVars.has(name))));
  if (missingFallback.length > 0) {
    issues.push(`styles.css fallback :root is missing ${missingFallback.length} var(s): ${missingFallback.join(", ")}`);
  }

  if (issues.length > 0) {
    console.error("Theme variable check failed:\n");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(
    `Theme variable check passed. ${usedVars.size} used var(s) are defined in ${themeEntries.length} theme(s) and in styles.css fallback.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
