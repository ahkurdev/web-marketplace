// ponytail: Self-contained AKCA automated penetration & security regression runner
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMarketplaceApp } from './server.ts';
import { AkcaWebScanner } from './scanner.ts';

// Helper for HTTP requests
function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const method = options.method || 'GET';
    const payload = options.body !== undefined
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : null;

    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (payload) {
      if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            raw,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log('   ENI-CYBER AKCA WEB SCANNER & SECURITY AUDIT      ');
  console.log('   Framework: AKCA v2.4 (Offensive/Defensive)       ');
  console.log('====================================================\n');

  // Start test server with rate limit window (max 60 reqs per 10s window)
  const { server, rateLimiter } = createMarketplaceApp({ windowMs: 10_000, maxRequests: 60 });
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[INIT] Target application online at ${baseUrl}`);

  try {
    // PHASE 1: AKCA AUTOMATED VULNERABILITY SCANNER EXECUTION
    console.log('\n[SCAN] Running AKCA Automated Vulnerability Scanner...');
    const scanner = new AkcaWebScanner(baseUrl);
    const audit = await scanner.runAudit();

    console.log('\n--- SCAN FINDINGS ---');
    for (const finding of audit.findings) {
      const mark = finding.status === 'PASSED' ? '[PASS]' : '[FAIL]';
      console.log(`${mark} [${finding.severity}] ${finding.category} -> ${finding.testName}`);
      console.log(`       Evidence: ${finding.evidence}`);
      if (finding.remediation) {
        console.log(`       Remediation: ${finding.remediation}`);
      }
    }

    console.log('\n--- AUDIT SUMMARY ---');
    console.log(`Total Checks Executed : ${audit.totalChecks}`);
    console.log(`Passed Checks         : ${audit.passed}`);
    console.log(`Failed Checks         : ${audit.failed}`);
    console.log(`Security Grade        : ${audit.grade}`);

    assert.equal(audit.failed, 0, `Expected 0 failed checks, found ${audit.failed}`);
    assert.equal(audit.grade, 'A+', 'Expected security grade A+');

    // Reset rate limiter for post-audit regression test
    rateLimiter.reset();

    // PHASE 2: APPLICATION BUSINESS REGRESSION VERIFICATION
    console.log('\n[REGRESSION] Verifying marketplace functionality with security hardening enabled...');

    // 1. Health check with headers verification
    const health = await request(baseUrl, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'healthy');
    assert.equal(health.headers['x-content-type-options'], 'nosniff');
    assert.equal(health.headers['x-frame-options'], 'DENY');
    assert(health.headers['content-security-policy']?.includes("default-src 'self'"));

    // 2. Legitimate Product Creation & XSS Sanitization Check
    const prodRes = await request(baseUrl, '/api/products', {
      method: 'POST',
      body: {
        name: 'Cyber Deck Alpha',
        price: 1500,
        stock: 5,
        description: 'Hardened terminal device <safe>',
      },
    });
    assert.equal(prodRes.status, 201);
    const prodId = prodRes.body.data.id;
    // Verify tag sanitized
    assert.equal(prodRes.body.data.description, 'Hardened terminal device &lt;safe&gt;');

    // 3. Legitimate Cart & Checkout Flow
    const userHeader = { 'x-user-id': 'hacker-007' };
    const cartRes = await request(baseUrl, '/api/cart/items', {
      method: 'POST',
      headers: userHeader,
      body: { productId: prodId, quantity: 2 },
    });
    assert.equal(cartRes.status, 200);
    assert.equal(cartRes.body.data.items[0].quantity, 2);

    const checkoutRes = await request(baseUrl, '/api/orders/checkout', {
      method: 'POST',
      headers: userHeader,
    });
    assert.equal(checkoutRes.status, 201);
    const orderId = checkoutRes.body.data.id;
    assert.equal(checkoutRes.body.data.totalAmount, 3000);

    // 4. Legitimate Payment
    const payRes = await request(baseUrl, '/api/payments/pay', {
      method: 'POST',
      headers: userHeader,
      body: { orderId, amount: 3000, paymentMethod: 'quantum_credit' },
    });
    assert.equal(payRes.status, 200);
    assert.equal(payRes.body.data.order.status, 'PAID');

    // 5. Clean teardown check
    console.log('[REGRESSION] All marketplace business operations function seamlessly under active protection.');
    console.log('\n====================================================');
    console.log('   ALL SECURITY AUDIT & FUNCTIONAL CHECKS PASSED    ');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('[FATAL] Security verification failed:', err);
  process.exit(1);
});
