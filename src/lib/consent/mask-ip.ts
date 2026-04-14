// LGPD — pseudonimização por máscara de prefixo.
// IPv4 → /24, IPv6 → /48. Entrada inválida → null.

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function maskIpv4(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

function maskIpv6(ip: string): string | null {
  const raw = ip.replace(/^\[|\]$/g, "");
  if (!raw.includes(":")) return null;

  const expanded = expandIpv6(raw);
  if (!expanded) return null;

  const groups = expanded.split(":");
  if (groups.length !== 8) return null;

  const prefix = groups.slice(0, 3).join(":");
  return `${prefix}::/48`;
}

function expandIpv6(ip: string): string | null {
  const zoneIdx = ip.indexOf("%");
  const addr = zoneIdx >= 0 ? ip.slice(0, zoneIdx) : ip;

  if (addr.split("::").length > 2) return null;

  const [head, tail] = addr.includes("::") ? addr.split("::") : [addr, ""];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];

  if (headParts.length + tailParts.length > 8) return null;
  const fillCount = 8 - headParts.length - tailParts.length;
  if (fillCount < 0) return null;

  const fill = addr.includes("::")
    ? Array(fillCount).fill("0")
    : [];

  const all = [...headParts, ...fill, ...tailParts];
  if (all.length !== 8) return null;

  for (const g of all) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }

  return all.map((g) => g.toLowerCase()).join(":");
}

export function maskIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = raw.trim();
  if (!ip) return null;

  if (IPV4_RE.test(ip)) return maskIpv4(ip);
  if (ip.includes(":")) return maskIpv6(ip);
  return null;
}
