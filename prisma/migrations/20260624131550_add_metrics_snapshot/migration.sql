-- CreateTable
CREATE TABLE "MetricsSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" INTEGER NOT NULL,
    "memTotal" BIGINT NOT NULL,
    "memUsed" BIGINT NOT NULL,
    "diskTotal" BIGINT NOT NULL,
    "diskUsed" BIGINT NOT NULL,
    "tempCelsius" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "DeviceConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "wifiInterface" TEXT NOT NULL DEFAULT 'wlan0',
    "hotspotIp" TEXT NOT NULL DEFAULT '172.16.42.1',
    "hotspotSsid" TEXT NOT NULL DEFAULT 'yingnode'
);

-- CreateIndex
CREATE INDEX "MetricsSnapshot_timestamp_idx" ON "MetricsSnapshot"("timestamp");
