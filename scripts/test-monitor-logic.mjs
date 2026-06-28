#!/usr/bin/env node
/**
 * yingnode monitor state machine — logic simulation test.
 * Mocks all I/O to verify state transitions. Run: node scripts/test-monitor-logic.mjs
 */

// ---- Mock state ----
let dbStatus = { status: "ONLINE", hotspotActive: false }
let mockAssociated = false
let mockPingOk = false
let hotspotStartCallCount = 0
let hotspotStopCallCount = 0
// ---- Simulated networkService ----
const networkService = {
  async getStatus() {
    return { status: dbStatus.status, hotspotActive: dbStatus.hotspotActive }
  },
  async isWiFiAssociated() {
    return mockAssociated
  },
  async checkConnectivity() {
    return mockPingOk
  },
  async startHotspot() {
    hotspotStartCallCount++
    console.log("    → startHotspot() called")
    dbStatus = { status: "HOTSPOT_ACTIVE", hotspotActive: true }
  },
  async stopHotspot() {
    hotspotStopCallCount++
    console.log("    → stopHotspot() called")
    dbStatus = { status: "ONLINE", hotspotActive: false }
  },
  async updateDB(fields) {
    if (fields.status !== undefined) dbStatus.status = fields.status
    if (fields.hotspotActive !== undefined) dbStatus.hotspotActive = fields.hotspotActive
  },
}

// ---- Monitor (exact copy of instrumentation.ts logic) ----
let offlineTicks = 0
let onlineTicks = 0
let checking = false

async function check() {
  if (checking) return
  checking = true

  try {
    const status = await networkService.getStatus()
    const associated = await networkService.isWiFiAssociated()

    // While hotspot is active, AP mode shows as "not associated" —
    // prevent offlineTicks from accumulating and retriggering start.
    if (status.hotspotActive) {
      offlineTicks = 0
    }

    if (associated) {
      offlineTicks = 0
      const pingOk = await networkService.checkConnectivity()

      if (pingOk) {
        onlineTicks++
        if (status.hotspotActive && onlineTicks >= 3) {
          await networkService.stopHotspot()
          onlineTicks = 0
        }
      } else {
        onlineTicks = 0
      }
    } else {
      onlineTicks = 0
      offlineTicks++

      if (!status.hotspotActive && offlineTicks >= 3) {
        await networkService.startHotspot()
        offlineTicks = 0
      }

      if (status.status !== "HOTSPOT_ACTIVE" && offlineTicks >= 3) {
        await networkService.updateDB({ status: "OFFLINE" })
      }
    }
  } catch (error) {
    console.error("check error:", error)
  } finally {
    checking = false
  }
}

// ---- Test runner ----
let testNum = 0
let failures = 0

function reset() {
  dbStatus = { status: "ONLINE", hotspotActive: false }
  mockAssociated = false
  mockPingOk = false
  hotspotStartCallCount = 0
  hotspotStopCallCount = 0
  offlineTicks = 0
  onlineTicks = 0
  testNum++
}

async function tick(n = 1) {
  for (let i = 0; i < n; i++) await check()
}

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`)
  } else {
    console.log(`  ✗ FAIL: ${msg}`)
    failures++
  }
}

async function runTests() {
  console.log("=== yingnode monitor state machine tests ===\n")

  // Test 1: WiFi disconnected → hotspot starts after 3 ticks
  reset()
  console.log(`Test ${testNum}: WiFi disconnected → hotspot auto-start`)
  mockAssociated = false
  mockPingOk = false
  await tick(2)
  assert(hotspotStartCallCount === 0, "tick 2: no hotspot yet")
  assert(dbStatus.hotspotActive === false, "tick 2: hotspot not active")
  await tick(1)
  assert(hotspotStartCallCount === 1, "tick 3: hotspot started")
  assert(dbStatus.hotspotActive === true, "tick 3: DB shows hotspot active")
  console.log()

  // Test 2: Hotspot active, WiFi reconnects → hotspot stops after 3 online ticks
  reset()
  console.log(`Test ${testNum}: WiFi reconnects → hotspot auto-stop`)
  dbStatus = { status: "HOTSPOT_ACTIVE", hotspotActive: true }
  mockAssociated = true
  mockPingOk = true
  await tick(3)
  assert(hotspotStopCallCount === 1, "3 online ticks: hotspot stopped")
  assert(dbStatus.hotspotActive === false, "DB shows hotspot inactive")
  console.log()

  // Test 3: WiFi associated but no internet → do nothing
  reset()
  console.log(`Test ${testNum}: WiFi associated, no internet (captive portal) → do nothing`)
  mockAssociated = true
  mockPingOk = false
  await tick(10)
  assert(hotspotStartCallCount === 0, "hotspot never started")
  assert(hotspotStopCallCount === 0, "hotspot never stopped")
  console.log()

  // Test 4: Hotspot active, counters don't leak
  reset()
  console.log(`Test ${testNum}: Hotspot active → offlineTicks stays at 0`)
  dbStatus = { status: "HOTSPOT_ACTIVE", hotspotActive: true }
  mockAssociated = false
  await tick(10)
  assert(offlineTicks <= 1, "offlineTicks not accumulating (reset each tick, max 1)")
  assert(hotspotStartCallCount === 0, "no duplicate startHotspot calls")
  console.log()

  // Test 5: Hotspot starts, WiFi immediately reconnects, hotspot stops
  reset()
  console.log(`Test ${testNum}: Disconnect → hotspot → reconnect → stop`)
  mockAssociated = false
  mockPingOk = false
  await tick(3)
  assert(hotspotStartCallCount === 1, "hotspot started")
  assert(dbStatus.hotspotActive === true, "hotspot active")

  mockAssociated = true
  mockPingOk = true
  await tick(3)
  assert(hotspotStopCallCount === 1, "hotspot stopped")
  assert(dbStatus.hotspotActive === false, "hotspot inactive")
  console.log()

  // Test 6: Flaky WiFi — connects briefly, drops again
  reset()
  console.log(`Test ${testNum}: Flaky WiFi — brief reconnect, then drop`)
  mockAssociated = false
  await tick(3) // hotspot starts
  assert(hotspotStartCallCount === 1, "hotspot started")

  // brief reconnect (1 tick)
  mockAssociated = true
  mockPingOk = true
  await tick(1) // onlineTicks = 1, not enough to stop
  assert(hotspotStopCallCount === 0, "1 online tick: hotspot not stopped yet")

  // drops again immediately
  mockAssociated = false
  await tick(10) // offlineTicks reset by hotspot active guard
  assert(hotspotStartCallCount === 1, "no duplicate start")
  console.log()

  // Test 7: Concurrent tick guard
  reset()
  console.log(`Test ${testNum}: Mutex guard — overlapping ticks`)
  mockAssociated = false
  // Simulate concurrent ticks by calling check twice without await
  const p1 = check()
  const p2 = check()
  await Promise.all([p1, p2])
  // Only one should have incremented offlineTicks
  assert(offlineTicks === 1, "only one tick processed (mutex)")
  console.log()

  // Summary
  console.log("============================================")
  if (failures === 0) {
    console.log(" ALL TESTS PASSED")
  } else {
    console.log(` ${failures} TEST(S) FAILED`)
  }
  console.log("============================================")
  process.exit(failures > 0 ? 1 : 0)
}

runTests().catch(console.error)
