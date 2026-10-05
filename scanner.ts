// ponytail: Lightweight AKCA vulnerability scanner; expand with distributed fuzzing dictionary & headless browser AST DOM crawler for dynamic SPA coverage

import http from 'node:http';

export interface ScanResult {
  category: string;
  testName: string;
  target: string;
  status: 'PASSED' | 'FAILED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  evidence: string;
  remediation?: string;
}

export interface SecurityAuditSummary {
  timestamp: string;
  targetUrl: string;
  totalChecks: number;
  passed: number;
  failed: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  findings: ScanResult[];
}

function sendRawRequest(
  targetUrl: string,
  pathname: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, targetUrl);
    const method = options.method || 'GET';
    const payload = options.body !== undefined
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : null;

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (payload !== null && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (payload !== null) {
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          let parsed: any;
          try {
            parsed = JSON.parse(rawBody);
          } catch {
            parsed = rawBody;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            rawBody,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export class AkcaWebScanner {
  private targetUrl: string;
  private results: ScanResult[] = [];

  constructor(targetUrl: string) {
    this.targetUrl = targetUrl;
  }

  // 1. Audit Secure HTTP Headers
  async auditSecureHeaders(): Promise<void> {
    const res = await sendRawRequest(this.targetUrl, '/health');
    const headers = res.headers;

    const requiredHeaders: Array<{ name: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; check: (val?: string) => boolean }> = [
      {
        name: 'content-security-policy',
        severity: 'HIGH',
        check: (v) => !!v && v.includes("default-src"),
      },
      {
        name: 'x-content-type-options',
        severity: 'MEDIUM',
        check: (v) => v === 'nosniff',
      },
      {
        name: 'x-frame-options',
        severity: 'MEDIUM',
        check: (v) => !!v && ['DENY', 'SAMEORIGIN'].includes(v.toUpperCase()),
      },
      {
        name: 'strict-transport-security',
        severity: 'MEDIUM',
        check: (v) => !!v && v.includes('max-age'),
      },
      {
        name: 'referrer-policy',
        severity: 'LOW',
        check: (v) => !!v,
      },
    ];

    for (const h of requiredHeaders) {
      const val = headers[h.name] as string | undefined;
      const isValid = h.check(val);
      this.results.push({
        category: 'SECURE_HEADERS',
        testName: `Header Verification: ${h.name}`,
        target: '/health',
        status: isValid ? 'PASSED' : 'FAILED',
        severity: h.severity,
        evidence: val ? `Found: ${val}` : 'Header missing',
        remediation: isValid ? undefined : `Inject ${h.name} header in all server responses`,
      });
    }
  }

  // 2. Audit Cross-Site Scripting (XSS) - Stored & Reflected
  async auditXss(): Promise<void> {
    const xssPayloads = [
      '<script>alert("AKCA-XSS")</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(document.cookie)>',
    ];

    for (const payload of xssPayloads) {
      const createRes = await sendRawRequest(this.targetUrl, '/api/products', {
        method: 'POST',
        body: {
          name: `XSS-Test ${payload}`,
          price: 99,
          stock: 10,
          description: `Payload: ${payload}`,
        },
      });

      const responseText = createRes.rawBody;
      const containsRawUnescaped = responseText.includes(payload);

      this.results.push({
        category: 'XSS_DEFENSE',
        testName: `Stored XSS Payload Neutralization: ${payload.substring(0, 25)}...`,
        target: '/api/products',
        status: !containsRawUnescaped ? 'PASSED' : 'FAILED',
        severity: 'HIGH',
        evidence: containsRawUnescaped ? 'Unescaped raw script payload reflected in response body' : 'Payload sanitized/escaped before storage/response',
        remediation: containsRawUnescaped ? 'Apply HTML entity encoding to string inputs' : undefined,
      });
    }

    // Reflected search probe
    const reflectedRes = await sendRawRequest(this.targetUrl, '/api/products?q=<script>alert(1)</script>');
    const reflectedRaw = reflectedRes.rawBody;
    const reflectedUnescaped = reflectedRaw.includes('<script>alert(1)</script>');
    this.results.push({
      category: 'XSS_DEFENSE',
      testName: 'Reflected XSS Query Parameter Neutralization',
      target: '/api/products?q=...',
      status: !reflectedUnescaped ? 'PASSED' : 'FAILED',
      severity: 'HIGH',
      evidence: reflectedUnescaped ? 'Raw script tag reflected from query string' : 'Query string safely filtered/escaped',
      remediation: reflectedUnescaped ? 'Filter dangerous tags in query parameters' : undefined,
    });
  }

  // 3. Audit SQL Injection (SQLi)
  async auditSqlInjection(): Promise<void> {
    const sqliProbes = [
      "' OR '1'='1",
      "' OR 1=1 --",
      "UNION SELECT null, username, password FROM users",
      "1; DROP TABLE products;--",
    ];

    for (const probe of sqliProbes) {
      // Query param probe
      const res = await sendRawRequest(this.targetUrl, `/api/products?q=${encodeURIComponent(probe)}`);
      // AKCA guard should block or sanitize without syntax error/leak
      const isBlocked = res.statusCode === 400 || res.statusCode === 403;
      const leaksSql = /syntax error|unclosed quotation|sqlite3|pg_query/i.test(res.rawBody);

      this.results.push({
        category: 'SQLI_DEFENSE',
        testName: `SQLi Signature Block: ${probe.substring(0, 25)}`,
        target: `/api/products?q=...`,
        status: isBlocked && !leaksSql ? 'PASSED' : 'FAILED',
        severity: 'CRITICAL',
        evidence: `Status: ${res.statusCode}. Body: ${res.rawBody.substring(0, 100)}`,
        remediation: isBlocked ? undefined : 'Deploy AKCA input inspection regex to intercept SQL keywords',
      });
    }
  }

  // 4. Audit NoSQL Injection & Prototype Pollution
  async auditNoSqlInjection(): Promise<void> {
    // Probe 1: NoSQL operator in body
    const nosqlRes = await sendRawRequest(this.targetUrl, '/api/products', {
      method: 'POST',
      body: {
        name: 'Valid Name',
        price: 50,
        stock: 5,
        $gt: '',
      },
    });

    const isNosqlBlocked = nosqlRes.statusCode === 400 || nosqlRes.statusCode === 403;
    this.results.push({
      category: 'NOSQLI_DEFENSE',
      testName: 'NoSQL Operator Injection ($gt) Blocking',
      target: '/api/products',
      status: isNosqlBlocked ? 'PASSED' : 'FAILED',
      severity: 'HIGH',
      evidence: `Status: ${nosqlRes.statusCode}. Reason: ${nosqlRes.rawBody.substring(0, 100)}`,
      remediation: isNosqlBlocked ? undefined : 'Sanitize keys starting with $ or reject payload',
    });

    // Probe 2: Prototype pollution payload
    const protoPayload = JSON.parse('{"name":"Pollution Probe","price":10,"stock":1,"__proto__":{"polluted":true}}');
    const protoRes = await sendRawRequest(this.targetUrl, '/api/products', {
      method: 'POST',
      body: protoPayload,
    });
    const isProtoBlocked = protoRes.statusCode === 400 || protoRes.statusCode === 403;

    this.results.push({
      category: 'PROTOTYPE_POLLUTION',
      testName: 'Prototype Pollution (__proto__) Neutralization',
      target: '/api/products',
      status: isProtoBlocked ? 'PASSED' : 'FAILED',
      severity: 'HIGH',
      evidence: `Status: ${protoRes.statusCode}. Result: ${protoRes.rawBody.substring(0, 100)}`,
      remediation: isProtoBlocked ? undefined : 'Strip __proto__, constructor, and prototype keys',
    });
  }

  // 5. Audit CSRF Origin Protection
  async auditCsrf(): Promise<void> {
    const evilOrigin = 'https://malicious-attacker.evil';
    const csrfRes = await sendRawRequest(this.targetUrl, '/api/products', {
      method: 'POST',
      headers: {
        Origin: evilOrigin,
      },
      body: {
        name: 'CSRF Product',
        price: 100,
        stock: 5,
      },
    });

    const isCsrfBlocked = csrfRes.statusCode === 403;
    this.results.push({
      category: 'CSRF_PROTECTION',
      testName: 'Untrusted Cross-Origin Mutation Block',
      target: '/api/products',
      status: isCsrfBlocked ? 'PASSED' : 'FAILED',
      severity: 'HIGH',
      evidence: `Origin: ${evilOrigin} -> HTTP Status: ${csrfRes.statusCode}`,
      remediation: isCsrfBlocked ? undefined : 'Enforce Origin / Referer validation for mutation requests',
    });
  }

  // 6. Audit Rate Limiting & DoS Protection
  async auditRateLimiting(): Promise<void> {
    let hitLimit = false;
    let limitStatusCode = 0;

    // Send rapid burst of 70 requests (server default is 60 or custom limit)
    for (let i = 0; i < 70; i++) {
      const res = await sendRawRequest(this.targetUrl, '/api/products');
      if (res.statusCode === 429) {
        hitLimit = true;
        limitStatusCode = 429;
        break;
      }
    }

    this.results.push({
      category: 'RATE_LIMITING',
      testName: 'Burst Request Throttling (HTTP 429)',
      target: '/api/products',
      status: hitLimit ? 'PASSED' : 'FAILED',
      severity: 'MEDIUM',
      evidence: hitLimit ? `HTTP 429 triggered with rate limit reset headers` : `Sent 70 requests without rate limiting`,
      remediation: hitLimit ? undefined : 'Implement token bucket / sliding window rate limiting',
    });
  }

  // 7. Audit Input Boundary & Tampering
  async auditInputValidation(): Promise<void> {
    // Negative price
    const negPrice = await sendRawRequest(this.targetUrl, '/api/products', {
      method: 'POST',
      body: { name: 'Free Item', price: -50, stock: 10 },
    });

    // Negative stock
    const negStock = await sendRawRequest(this.targetUrl, '/api/products', {
      method: 'POST',
      body: { name: 'Negative Stock', price: 10, stock: -5 },
    });

    // Empty product name
    const emptyName = await sendRawRequest(this.targetUrl, '/api/products', {
      method: 'POST',
      body: { name: '   ', price: 10, stock: 5 },
    });

    const allValidated = negPrice.statusCode === 400 && negStock.statusCode === 400 && emptyName.statusCode === 400;

    this.results.push({
      category: 'INPUT_VALIDATION',
      testName: 'Boundary Checking (Price, Stock, Empty Strings)',
      target: '/api/products',
      status: allValidated ? 'PASSED' : 'FAILED',
      severity: 'MEDIUM',
      evidence: `Negative Price: ${negPrice.statusCode}, Negative Stock: ${negStock.statusCode}, Empty Name: ${emptyName.statusCode}`,
      remediation: allValidated ? undefined : 'Add strict bounds checking for numeric and string fields',
    });
  }

  // Run Full Audit Suite
  async runAudit(): Promise<SecurityAuditSummary> {
    this.results = [];
    await this.auditSecureHeaders();
    await this.auditXss();
    await this.auditSqlInjection();
    await this.auditNoSqlInjection();
    await this.auditCsrf();
    await this.auditInputValidation();
    await this.auditRateLimiting();

    const totalChecks = this.results.length;
    const passed = this.results.filter((r) => r.status === 'PASSED').length;
    const failed = this.results.filter((r) => r.status === 'FAILED').length;

    let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (failed === 0) grade = 'A+';
    else if (failed <= 2) grade = 'B';
    else grade = 'F';

    return {
      timestamp: new Date().toISOString(),
      targetUrl: this.targetUrl,
      totalChecks,
      passed,
      failed,
      grade,
      findings: this.results,
    };
  }
}
