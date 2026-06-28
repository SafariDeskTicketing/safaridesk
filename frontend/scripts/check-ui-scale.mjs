import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');
const strict = args.has('--strict');

const root = process.cwd();
const baselinePath = path.join(root, 'ui-scale-baseline.json');
const scopeRoots = [
  'src/components/config',
  'src/components/settings',
  'src/pages/config',
  'src/pages/users',
  'src/pages/sla',
];
const extensions = new Set(['.ts', '.tsx', '.css']);
const allowedPx = new Set([12, 14, 16, 18, 24, 28, 32]);

const tailwindSizeToPx = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
};

const toPosix = (value) => value.split(path.sep).join('/');

const getLineNumber = (content, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
};

const walkFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = toPosix(path.relative(root, filePath));
  const violations = [];

  const arbitraryPxRegex = /text-\[(\d+)px\]/g;
  let arbitraryMatch = arbitraryPxRegex.exec(content);
  while (arbitraryMatch) {
    const px = Number(arbitraryMatch[1]);
    if (!allowedPx.has(px)) {
      violations.push({
        file: relPath,
        line: getLineNumber(content, arbitraryMatch.index),
        rule: 'arbitrary-px-out-of-scale',
        value: arbitraryMatch[0],
        message: `Found ${arbitraryMatch[0]} (${px}px) outside approved scale 12/14/16/18/24/28/32.`,
      });
    }
    arbitraryMatch = arbitraryPxRegex.exec(content);
  }

  const tailwindSizeRegex = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/g;
  let tailwindMatch = tailwindSizeRegex.exec(content);
  while (tailwindMatch) {
    const size = tailwindMatch[1];
    const px = tailwindSizeToPx[size];
    if (!allowedPx.has(px)) {
      violations.push({
        file: relPath,
        line: getLineNumber(content, tailwindMatch.index),
        rule: 'tailwind-size-out-of-scale',
        value: tailwindMatch[0],
        message: `Found ${tailwindMatch[0]} (~${px}px) outside approved scale 12/14/16/18/24/28/32.`,
      });
    }
    tailwindMatch = tailwindSizeRegex.exec(content);
  }

  return violations;
};

const fingerprint = (violation) =>
  `${violation.file}:${violation.line}:${violation.rule}:${violation.value}`;

const scanScope = () => {
  const files = scopeRoots.flatMap((scopeRoot) => walkFiles(path.join(root, scopeRoot)));
  return files.flatMap((filePath) => scanFile(filePath));
};

const violations = scanScope();
const currentEntries = Array.from(new Set(violations.map((v) => fingerprint(v)))).sort();

if (updateBaseline) {
  const payload = {
    generatedAt: new Date().toISOString(),
    scopeRoots,
    allowedPx: Array.from(allowedPx).sort((a, b) => a - b),
    entries: currentEntries,
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Updated baseline at ${toPosix(path.relative(root, baselinePath))}`);
  console.log(`Stored ${currentEntries.length} baseline entries.`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('Missing ui-scale-baseline.json. Run: npm run ui-scale:baseline');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineEntries = new Set(Array.isArray(baseline.entries) ? baseline.entries : []);

const newViolations = violations.filter((violation) => !baselineEntries.has(fingerprint(violation)));

if (newViolations.length > 0) {
  console.error('New UI scale violations detected (outside baseline):');
  for (const violation of newViolations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.value}`);
  }
  process.exit(1);
}

if (strict && currentEntries.length > baselineEntries.size) {
  console.error('Strict mode failed: current entries exceed baseline entries.');
  process.exit(1);
}

console.log(
  `UI scale check passed. ${violations.length} scoped entries match baseline; no new out-of-scale typography patterns found.`
);
