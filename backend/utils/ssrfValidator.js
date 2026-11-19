/**
 * ssrfValidator.js
 * Validates URLs against Server-Side Request Forgery (SSRF) threats.
 */

const { URL } = require("url");

// Private/Reserved IPv4 patterns
const PRIVATE_IPV4_PATTERNS = [
  /^127\./,                         // Loopback (127.0.0.0/8)
  /^10\./,                          // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B (172.16.0.0/12)
  /^192\.168\./,                    // Private Class C (192.168.0.0/16)
  /^169\.254\./,                    // Link-local / Cloud metadata (169.254.0.0/16)
  /^0\./                            // Current network
];

// Blocked Hostnames
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "instance-data",
  "metadata.google.internal"
]);

/**
 * Validates whether a URL is safe to make an outbound HTTP request to.
 * @param {string} urlString 
 * @returns {{ safe: boolean, error?: string }}
 */
function validateSafeUrl(urlString) {
  if (typeof urlString !== "string" || !urlString.trim()) {
    return { safe: false, error: "Empty or invalid URL input" };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { safe: false, error: "Malformed URL syntax" };
  }

  // Only HTTP and HTTPS schemes allowed
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, error: `Disallowed protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { safe: false, error: `Access to internal host is blocked: ${hostname}` };
  }

  // Check private IPv4 ranges
  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(hostname)) {
      return { safe: false, error: `Access to private IP range is blocked: ${hostname}` };
    }
  }

  // Check IPv6 loopback / local
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const rawIpv6 = hostname.slice(1, -1).toLowerCase();
    if (rawIpv6 === "::1" || rawIpv6.startsWith("fe80:") || rawIpv6.startsWith("fc00:")) {
      return { safe: false, error: `Access to private IPv6 address is blocked: ${hostname}` };
    }
  }

  return { safe: true };
}

module.exports = {
  validateSafeUrl
};
