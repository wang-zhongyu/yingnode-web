import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock shell before importing the module under test
vi.mock("@/shared/lib/shell", () => ({
  execAsync: vi.fn(),
  safeArg: vi.fn((s: string) => `'${s}'`),
  escapeShellArg: vi.fn((s: string) => s),
}))

// Mock constants for PING_TARGETS
vi.mock("@/shared/lib/network/constants", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/network/constants")>(
    "@/shared/lib/network/constants",
  )
  return { ...actual }
})

import { isWiFiAssociated, hasExternalIp } from "@/shared/lib/network/connectivity"
import { execAsync } from "@/shared/lib/shell"

const mockExecAsync = vi.mocked(execAsync)

// Minimal state mock matching NetworkServiceState
function mockState(hotspotIp = "172.16.42.1") {
  return {
    getConfig: vi.fn().mockResolvedValue({
      wifiInterface: "wlan0",
      hotspotIp,
      hotspotSsid: "yingnode",
      hotspotPassword: "",
    }),
    clearConfigCache: vi.fn(),
    staticIpEnsured: false,
    startingHotspot: false,
    lastHotspotFailure: 0,
    lastHotspotError: null,
  }
}

describe("isWiFiAssociated", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns false when iw link reports Not connected", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "Not connected.\n", stderr: "" })

    const result = await isWiFiAssociated(mockState())
    expect(result).toBe(false)
  })

  it("returns true when iw link shows an associated BSSID", async () => {
    mockExecAsync.mockResolvedValue({
      stdout: "Connected to 02:00:00:00:00:00 (on wlan0)\n\tSSID: MyNetwork\n",
      stderr: "",
    })

    const result = await isWiFiAssociated(mockState())
    expect(result).toBe(true)
  })
})

describe("hasExternalIp", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns false when associated but only has hotspot IP", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "Connected to 02:00:00:00:00:00\n", stderr: "" })
      .mockResolvedValueOnce({
        stdout: "    inet 172.16.42.1/24 scope global wlan0\n",
        stderr: "",
      })

    const result = await hasExternalIp(mockState("172.16.42.1"))
    expect(result).toBe(false)
  })

  it("returns true when interface has a non-hotspot DHCP IP", async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: "Connected to 02:00:00:00:00:00\n", stderr: "" })
      .mockResolvedValueOnce({
        stdout: "    inet 192.168.1.100/24 brd 192.168.1.255 scope global wlan0\n",
        stderr: "",
      })

    const result = await hasExternalIp(mockState("172.16.42.1"))
    expect(result).toBe(true)
  })
})
