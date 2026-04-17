import { describe, expect, it } from "vitest";
import { maskIp } from "../mask-ip";

describe("maskIp", () => {
  it("mascara IPv4 em /24", () => {
    expect(maskIp("192.168.1.42")).toBe("192.168.1.0/24");
    expect(maskIp("10.0.0.1")).toBe("10.0.0.0/24");
    expect(maskIp("  8.8.8.8  ")).toBe("8.8.8.0/24");
  });

  it("mascara IPv6 em /48", () => {
    expect(maskIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:0db8:85a3::/48");
    expect(maskIp("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(maskIp("::1")).toBe("0:0:0::/48");
    expect(maskIp("[fe80::1]")).toBe("fe80:0:0::/48");
  });

  it("descarta entrada inválida", () => {
    expect(maskIp("")).toBeNull();
    expect(maskIp(null)).toBeNull();
    expect(maskIp(undefined)).toBeNull();
    expect(maskIp("not-an-ip")).toBeNull();
    expect(maskIp("999.999.999.999")).toBeNull();
    expect(maskIp("1.2.3")).toBeNull();
    expect(maskIp("2001::db8::1")).toBeNull();
  });
});
