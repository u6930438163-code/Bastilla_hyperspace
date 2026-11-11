import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next']);
const extensions = /\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/;
async function* sources(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) yield* sources(path);
    else if (item.isFile() && extensions.test(item.name) && !path.includes('security-regression.test.mjs')) yield path;
  }
}

test('no hard-coded omnipotent root access tokens', async () => {
  const findings = [];
  for await (const path of sources(process.cwd())) {
    const source = await readFile(path, 'utf8');
    // These exact patterns were introduced in a prior commit and bypassed configured authentication.
    if (/364_OMNIKLUCZ_ROOT|DEFAULT_ROOT_SECURITY_TOKEN/.test(source)) findings.push(path);
  }
  assert.deepEqual(findings, [], 'Remove hard-coded root bypasses from: ' + findings.join(', '));
});

test('production AI authorization does not trust forwarded host headers', async () => {
  const findings = [];
  for await (const path of sources(process.cwd())) {
    const source = await readFile(path, 'utf8');
    if (/function allowLocalOrToken\s*\(/.test(source) &&
        /return hostIsLocalOrPreview\s*\|\|/.test(source)) findings.push(path);
  }
  assert.deepEqual(findings, [], 'Remove host-header-based authentication bypass in: ' + findings.join(', '));
});

test('workers require configured stable credentials', async () => {
  const source = await readFile(join(process.cwd(), 'server.ts'), 'utf8');
  assert.match(source, /const tokensValid = AGENTS\.every/);
  assert.doesNotMatch(source, /if \(!raw\) return Object\.fromEntries\(AGENTS\.map/);
});

test('agent activity endpoint is available to authenticated operator', async () => {
  const source = await readFile(join(process.cwd(), 'server.ts'), 'utf8');
  assert.match(source, /app\.get\('\/api\/agents\/activity'/);
  assert.doesNotMatch(source, /req\.path\.startsWith\('\/agents\/activity'\)/);
});
