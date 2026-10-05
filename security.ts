// ponytail: In-memory AKCA security guard; upgrade to Redis-backed distributed rate limiter + WAF engine for multi-region scale

export interface SecurityCheckResult {
  allowed: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export const SECURE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-XSS-Protection': '0',
};

// SQL Injection detection regex
const SQLI_PATTERNS = [
  /(\b(SELECT\s+[\s\S]+FROM|INSERT\s+INTO\s+[\s\S]+|UPDATE\s+[\s\S]+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|UNION(\s+ALL)?\s+SELECT)\b)/i,
  /(('|--|#|\/\*)\s*(OR|AND)\s+['"\d\w]+\s*=\s*['"\d\w]+)/i,
  /(;\s*(DROP|DELETE|UPDATE|INSERT|CREATE)\b)/i,
  /('\s*OR\s+'?1'?\s*=\s*'?1'?)/i,
  /('\s*OR\s+1=1\s*(--|#|\/\*))/i,
];

// NoSQL & Prototype Pollution detection
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function detectSqlInjection(input: string): boolean {
  return SQLI_PATTERNS.some((pattern) => pattern.test(input));
}

export function detectNoSqlInjection(obj: unknown): { detected: boolean; reason?: string } {
  if (!obj || typeof obj !== 'object') return { detected: false };

  const stack = [obj];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    for (const [key, value] of Object.entries(current)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        return { detected: true, reason: `Prototype pollution key detected: ${key}` };
      }
      if (key.startsWith('$')) {
        return { detected: true, reason: `NoSQL operator key detected: ${key}` };
      }
      if (typeof value === 'string' && (value.includes('$where') || value.includes('return true'))) {
        return { detected: true, reason: `NoSQL code evaluation pattern detected: ${value}` };
      }
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return { detected: false };
}

// XSS Sanitizer: Escape HTML characters and neutralize dangerous attributes/protocols
export function sanitizeXss(val: unknown): unknown {
  if (typeof val === 'string') {
    return val
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeXss);
  }
  if (val !== null && typeof val === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(k)) continue;
      clean[k] = sanitizeXss(v);
    }
    return clean;
  }
  return val;
}

// Anti-CSRF Origin Validation for state-changing requests
export function validateCsrfOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true; // Direct API / non-browser clients permitted; browsers enforce Origin
  try {
    const originUrl = new URL(origin);
    if (!host) return false;
    const hostWithoutPort = host.split(':')[0];
    const originWithoutPort = originUrl.hostname;
    // Allow matching host or local development loops
    if (originWithoutPort === hostWithoutPort) return true;
    if (['localhost', '127.0.0.1'].includes(originWithoutPort) && ['localhost', '127.0.0.1'].includes(hostWithoutPort)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Full AKCA Request Inspection Pipeline
export function inspectRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  headers: Record<string, string | string[] | undefined>,
  body?: unknown
): SecurityCheckResult {
  const origin = typeof headers['origin'] === 'string' ? headers['origin'] : undefined;
  const host = typeof headers['host'] === 'string' ? headers['host'] : undefined;

  // 1. CSRF Verification on mutations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
    if (!validateCsrfOrigin(origin, host)) {
      return {
        allowed: false,
        statusCode: 403,
        error: 'CSRF Forbidden',
        message: `Cross-origin request from origin '${origin}' blocked by AKCA CSRF Guard`,
      };
    }
  }

  // 2. SQL Injection Inspection in Query String
  for (const [param, val] of searchParams.entries()) {
    if (detectSqlInjection(val)) {
      return {
        allowed: false,
        statusCode: 400,
        error: 'SQL Injection Blocked',
        message: `Malicious SQL injection signature detected in parameter '${param}'`,
      };
    }
  }

  // 3. NoSQL / Prototype Pollution & SQLi in Body
  if (body && typeof body === 'object') {
    const noSqlCheck = detectNoSqlInjection(body);
    if (noSqlCheck.detected) {
      return {
        allowed: false,
        statusCode: 400,
        error: 'NoSQL Injection Blocked',
        message: noSqlCheck.reason || 'Malicious NoSQL injection syntax detected',
      };
    }

    const checkBodyStrings = (val: unknown): boolean => {
      if (typeof val === 'string') return detectSqlInjection(val);
      if (Array.isArray(val)) return val.some(checkBodyStrings);
      if (val && typeof val === 'object') return Object.values(val).some(checkBodyStrings);
      return false;
    };

    if (checkBodyStrings(body)) {
      return {
        allowed: false,
        statusCode: 400,
        error: 'SQL Injection Blocked',
        message: 'Malicious SQL injection signature detected in request body payload',
      };
    }
  }

  return { allowed: true };
}
