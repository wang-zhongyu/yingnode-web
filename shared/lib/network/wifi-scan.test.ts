import { describe, it, expect } from "vitest"
import { parseIwScan, parseIwlist } from "@/shared/lib/network/wifi-scan"

const IW_SCAN_OUTPUT = `BSS 02:00:00:00:00:00(on wlan0)
\tlast seen: 120 ms ago
SSID: MyNetwork
freq: 2412
signal: -42.00 dBm
RSN:\t* Version: 1
\tGroup cipher: CCMP

BSS 02:00:00:00:01:00(on wlan0)
\tlast seen: 500 ms ago
SSID: \\x00
freq: 5180
signal: -78.00 dBm

BSS 02:00:00:00:02:00(on wlan0)
SSID: OpenGuest
freq: 5745
signal: -55.00 dBm`

const IWLIST_OUTPUT = `Cell 01 - Address: 02:00:00:00:00:00
          ESSID:"MyNetwork"
          Frequency:2.412 GHz
          Signal level=-42
          Encryption key:on

Cell 02 - Address: 02:00:00:00:01:00
          ESSID:"\\x00"
          Signal level=-78
          Encryption key:on

Cell 03 - Address: 02:00:00:00:02:00
          ESSID:"OpenGuest"
          Frequency:5.745 GHz
          Signal level=-55
          Encryption key:off`

describe("parseIwScan", () => {
  it("extracts SSID, signal, and security from valid iw scan output", () => {
    const result = parseIwScan(IW_SCAN_OUTPUT)

    expect(result).toHaveLength(2) // hidden SSID filtered out
    expect(result[0].ssid).toBe("MyNetwork")
    expect(result[0].signal).toBe(-42)
    expect(result[0].security).toBe("WPA2")
    expect(result[0].frequency).toBe(2.412)
  })

  it("skips hidden SSIDs (\\\\x00)", () => {
    const result = parseIwScan(IW_SCAN_OUTPUT)
    const hidden = result.find((n) => n.ssid === "\\x00")
    expect(hidden).toBeUndefined()
  })

  it("sorts networks by signal strength descending", () => {
    const result = parseIwScan(IW_SCAN_OUTPUT)
    expect(result[0].signal).toBeGreaterThanOrEqual(result[1]?.signal ?? -999)
  })

  it("handles OPEN networks without RSN/WPA", () => {
    const result = parseIwScan(IW_SCAN_OUTPUT)
    const open = result.find((n) => n.ssid === "OpenGuest")
    expect(open?.security).toBe("OPEN")
  })
})

describe("parseIwlist", () => {
  it("extracts SSID and signal from legacy iwlist output", () => {
    const result = parseIwlist(IWLIST_OUTPUT)

    expect(result).toHaveLength(2) // hidden filtered
    expect(result[0].ssid).toBe("MyNetwork")
    expect(result[0].signal).toBe(-42)
    expect(result[0].security).toBe("WPA2")
  })

  it("detects open networks from Encryption key:off", () => {
    const result = parseIwlist(IWLIST_OUTPUT)
    const open = result.find((n) => n.ssid === "OpenGuest")
    expect(open?.security).toBe("OPEN")
  })
})
