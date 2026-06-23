-- CreateTable
CREATE TABLE "NetworkStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "hotspotActive" BOOLEAN NOT NULL DEFAULT false,
    "lastCheck" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentSSID" TEXT,
    "ipAddress" TEXT
);
