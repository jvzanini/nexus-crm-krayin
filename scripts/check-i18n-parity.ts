/**
 * check-i18n-parity — compara chaves de mensagens entre locales br e us.
 * Falha se houver divergência de keys (chave existe em um e não no outro).
 */
import fs from "node:fs";
import path from "node:path";

type Pack = Record<string, unknown>;

const ROOT = path.resolve(__dirname, "..");
const BR_DIR = path.join(ROOT, "src/locale/packs/br/messages");
const US_DIR = path.join(ROOT, "src/locale/packs/us/messages");

// Pacotes cuja forma é intrinsecamente específica do locale
// (campos/regras locais ≠ tradução 1:1). Não exigimos paridade de chaves.
const LOCALE_SPECIFIC_PACKS = new Set<string>(["address", "common"]);

function listPacks(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"))
    .sort();
}

function loadPack(dir: string, name: string): Pack {
  const file = path.join(dir, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Pack;
}

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

function diff(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

function main(): number {
  const brPacks = listPacks(BR_DIR);
  const usPacks = listPacks(US_DIR);

  const missingInUs = brPacks.filter((p) => !usPacks.includes(p));
  const missingInBr = usPacks.filter((p) => !brPacks.includes(p));

  const errors: string[] = [];

  if (missingInUs.length) {
    errors.push(`Pacotes em br sem equivalente em us: ${missingInUs.join(", ")}`);
  }
  if (missingInBr.length) {
    errors.push(`Pacotes em us sem equivalente em br: ${missingInBr.join(", ")}`);
  }

  const shared = brPacks.filter((p) => usPacks.includes(p));
  const checked = shared.filter((p) => !LOCALE_SPECIFIC_PACKS.has(p));
  for (const name of checked) {
    const brKeys = flattenKeys(loadPack(BR_DIR, name));
    const usKeys = flattenKeys(loadPack(US_DIR, name));
    const onlyBr = diff(brKeys, usKeys);
    const onlyUs = diff(usKeys, brKeys);
    if (onlyBr.length || onlyUs.length) {
      errors.push(
        `[${name}] divergência de chaves → br-only: [${onlyBr.join(", ")}]  us-only: [${onlyUs.join(", ")}]`,
      );
    }
  }

  if (errors.length) {
    console.error("✗ i18n parity FALHOU");
    for (const e of errors) console.error("  -", e);
    return 1;
  }

  const skipped = shared.filter((p) => LOCALE_SPECIFIC_PACKS.has(p));
  console.log(
    `✓ i18n parity OK — verificados: [${checked.join(", ")}] | locale-específicos (pulados): [${skipped.join(", ")}]`,
  );
  return 0;
}

process.exit(main());
