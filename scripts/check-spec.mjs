#!/usr/bin/env node
// Dependency-free, read-only document checks; not an implementation conformance test.
import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(resolve(root, name), 'utf8');
const digest = text => createHash('sha256').update(text).digest('hex');
const core = read('agent-login-core.md');
const relay = read('relay-profile.md');
assert.equal(process.argv.length, 2, 'Usage: node scripts/check-spec.mjs');
const numbered = text => new Set([...text.matchAll(/^#{2,4} (\d+(?:\.\d+)*)(?:\.)? /gm)].map(m => m[1]));
const coreSections = numbered(core), relaySections = numbered(relay);
const ids = new Set();
for (const [name, target] of [['conformance.md', coreSections], ['relay-profile.md', relaySections]]) {
  for (const line of read(name).split('\n')) {
    const match = line.match(/^\| ([IRAL]-\d+) \| .* \| ([^|]+) \|$/);
    if (!match) { assert(!/^\| [IRAL]-\d+ \|/.test(line), `Cannot parse checklist row: ${line}`); continue; }
    const [, id, references] = match;
    assert(!ids.has(id), `Duplicate checklist ID: ${id}`);
    ids.add(id);
    // Linked companion sections are checked as links below; plain numbers name this checklist's document.
    for (const group of references.replace(/\[[^\]]+\]\([^)]+\)/g, '').split(';')) {
      const coreRef = group.trim().startsWith('Core');
      for (const ref of group.replace('Core', '').split(',').map(x => x.trim()).filter(Boolean)) {
        assert(/^[0-9]+(?:\.[0-9]+)*$/.test(ref), `${id}: cannot parse section ${ref}`);
        assert((coreRef ? coreSections : target).has(ref), `${id} names missing section ${ref}`);
      }
    }
  }
}

const slug = title => title.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
for (const name of readdirSync(root).filter(name => name.endsWith('.md'))) {
  const document = read(name);
  const prose = document.replace(/```[^\n]*\n[\s\S]*?```/g, '');
  for (const match of prose.matchAll(/\[[^\]\n]*\]\(([^\s)]+)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [file, anchor] = target.split('#');
    const path = resolve(root, decodeURIComponent(file || name));
    assert(!relative(root, path).startsWith('..'), `${name} links outside spec: ${target}`);
    assert(existsSync(path), `${name} has missing link: ${target}`);
    if (anchor && path.endsWith('.md')) {
      const anchors = [...readFileSync(path, 'utf8').matchAll(/^#{1,6} (.+)$/gm)].map(m => slug(m[1]));
      assert(anchors.includes(decodeURIComponent(anchor)), `${name} has missing anchor: ${target}`);
    }
  }
  assert.equal((document.match(/^```/gm) ?? []).length % 2, 0, `Unclosed fence in ${name}`);
}

// Verify the exact printed Appendix A bytes rather than silently regenerating them.
const part = (start, end) => core.slice(core.indexOf(start), end ? core.indexOf(end) : undefined);
const jwks = [...part('### A.2 ', '### A.3 ').matchAll(/```json\n([\s\S]*?)```/g)]
  .map(match => JSON.parse(match[1]));
assert.equal(jwks.length, 2, 'Expected Agent and Issuer public JWK examples');
const assertion = part('### A.4 ', '### A.5 ').match(/\{"assertion": "([A-Za-z0-9_.\-\s]+)"\}/)?.[1].replace(/\s+/g, '');
const token = part('### A.5 ', '## Appendix B.').match(/```\n(eyJ[A-Za-z0-9_.\-\s]+)\n```/)?.[1].replace(/\s+/g, '');
assert(assertion && token, 'Expected compact assertion and ID Token examples');
function checkJws(compact, jwk) {
  const parts = compact.split('.');
  assert.equal(parts.length, 3);
  const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url'));
  const signature = Buffer.from(parts[2], 'base64url');
  assert.equal(header.alg, 'ES256');
  assert.equal(signature.length, 64);
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const data = Buffer.from(parts.slice(0, 2).join('.'));
  assert(verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature), 'Example JWS signature is invalid');
  const tampered = Buffer.from(signature);
  tampered[0] ^= 1;
  assert(!verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, tampered), 'Tampered JWS verified');
  return { header, payload };
}
const signedAssertion = checkJws(assertion, jwks[0]);
const signedToken = checkJws(token, jwks[1]);
const thumbprint = jwk => digest(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
assert.equal(signedAssertion.header.kid, Buffer.from(thumbprint(jwks[0]), 'hex').toString('base64url'));
assert.equal(signedToken.header.kid, jwks[1].kid);
const printedAssertionObjects = part('### A.4 ', '### A.5 ').match(/```json\n([\s\S]*?)```/)[1]
  .trim().split(/\n\s*\n/).map(value => JSON.parse(value));
assert.deepEqual(signedAssertion.header, printedAssertionObjects[0]);
assert.deepEqual(signedAssertion.payload, printedAssertionObjects[1]);
const printedClaims = JSON.parse(part('### 3.4 ', '## 4. ').match(/```json\n([\s\S]*?)```/)[1]);
assert.deepEqual(signedToken.payload, printedClaims, 'Printed claims differ from signed ID Token');
assert.equal(signedAssertion.payload.exp - signedAssertion.payload.iat, 300);
assert.equal(signedToken.payload.exp - signedToken.payload.iat, 600);
const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const challenge = createHash('sha256').update(verifier).digest('base64url');
assert(core.includes(`code_verifier=${verifier}`));
assert(core.includes(`code_challenge=${challenge}`));

console.log(`Checked ${ids.size} checklist groups, section references, local links, two ES256 signatures, printed claims, thumbprint and PKCE.`);
console.log('No generated inventory or implementation conformance claim.');
