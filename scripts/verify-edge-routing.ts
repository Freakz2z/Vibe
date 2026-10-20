import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isIP} from 'node:net';

type Routing = {
  hostname: string;
  authority: string;
  officialCname: string;
  ttl: number;
  ipv4: string[];
};

const routing = JSON.parse(fs.readFileSync('ops/cdn-routing.json', 'utf8')) as Routing;
const addresses = (hostname: string, server: string) =>
  execFileSync('dig', ['@' + server, hostname, 'A', '+time=3', '+tries=1', '+short'], {encoding: 'utf8'})
    .trim().split(/\s+/).filter(value => isIP(value) === 4).sort();

assert(routing.ipv4.length >= 3, 'The incident workaround must retain multiple nodes');
assert(routing.ipv4.every(ip => isIP(ip) === 4));
assert.deepEqual(
  addresses(routing.hostname, routing.authority), [...routing.ipv4].sort(),
  'Authoritative DNS differs from the recorded routing plan',
);
// Geo DNS may return a subset. Absence from these samples needs manual review.
const official = [...new Set(['223.5.5.5', '119.29.29.29']
  .flatMap(server => addresses(routing.officialCname, server)))];
for (const ip of routing.ipv4) {
  assert(official.includes(ip), 'Node absent from sampled official DNS answers; manually review before rotating: ' + ip);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-edge-'));
const evidence: Record<string, unknown>[] = [];
let failed = 0;
try {
  for (const ip of routing.ipv4) {
    try {
      const bodyFile = path.join(tmp, 'body');
      const headersFile = path.join(tmp, 'headers');
      const result = JSON.parse(execFileSync('curl', [
        '--noproxy', '*', '--silent', '--show-error', '--connect-timeout', '5', '--max-time', '12',
        '--resolve', `${routing.hostname}:443:${ip}`, '-D', headersFile, '-o', bodyFile,
        '-w', '%{json}', `https://${routing.hostname}/api/health`,
      ], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
      assert.equal(result.http_code, 200, ip);
      assert.match(fs.readFileSync(headersFile, 'utf8'), /^server: ESA\r?$/mi);
      const health = JSON.parse(fs.readFileSync(bodyFile, 'utf8'));
      assert.equal(health.status, 'ok');
      assert.equal(health.database, 'ready');
      assert.equal(health.storage, 'ready');
      assert(health.tools >= 200);
      evidence.push({ip, ok: true, status: result.http_code, seconds: result.time_total, health});
      console.log(`PASS ${ip} TLS, ESA, D1 and R2 in ${result.time_total}s`);
    } catch (error) {
      const failure = error as Error & {stderr?: string; stdout?: string};
      const message = failure.stderr?.trim() || failure.message;
      evidence.push({ip, ok: false, error: message, transfer: failure.stdout || undefined});
      console.error(`FAIL ${ip}: ${message}`);
      failed++;
    }
  }
  fs.mkdirSync('artifacts', {recursive: true});
  fs.writeFileSync('artifacts/edge-routing.json', JSON.stringify({
    checkedAt: new Date().toISOString(), routing, officialSample: official, failed, evidence,
  }, null, 2));
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}
if (failed) process.exitCode = 1;
