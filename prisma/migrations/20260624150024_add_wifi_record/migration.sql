-- CreateTable
CREATE TABLE "WiFiRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ssid" TEXT NOT NULL,
    "security" TEXT NOT NULL DEFAULT 'WPA2',
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "WiFiRecord_ssid_key" ON "WiFiRecord"("ssid");
