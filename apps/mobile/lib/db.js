import * as SQLite from "expo-sqlite";

let _db;
async function db() {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync("rtkm.db");
    await _db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS pumps (
        id TEXT PRIMARY KEY,
        depot TEXT,
        cmsCode TEXT,
        roName TEXT,
        rtkm REAL,
        address TEXT,
        city TEXT,
        lat REAL,
        lng REAL,
        updatedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pumps_depot ON pumps(depot);
    `);
  }
  return _db;
}

// Upsert/delete a batch of pumps coming from /api/sync.
export async function upsertPumps(pumps) {
  const d = await db();
  await d.withTransactionAsync(async () => {
    for (const p of pumps) {
      if (p.isDeleted) {
        await d.runAsync("DELETE FROM pumps WHERE id = ?", [p.id]);
        continue;
      }
      await d.runAsync(
        `INSERT INTO pumps (id, depot, cmsCode, roName, rtkm, address, city, lat, lng, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           depot=excluded.depot, cmsCode=excluded.cmsCode, roName=excluded.roName,
           rtkm=excluded.rtkm, address=excluded.address, city=excluded.city,
           lat=excluded.lat, lng=excluded.lng, updatedAt=excluded.updatedAt`,
        [p.id, p.depot, p.cmsCode, p.roName, p.rtkm, p.address || "", p.city || "",
         p.lat, p.lng, p.updatedAt]
      );
    }
  });
}

export async function countPumps() {
  const d = await db();
  const row = await d.getFirstAsync("SELECT COUNT(*) AS n FROM pumps");
  return row?.n || 0;
}

// Search local cache (offline).
export async function searchPumps(depot, query, limit = 20) {
  const d = await db();
  const q = `%${(query || "").trim()}%`;
  return d.getAllAsync(
    `SELECT * FROM pumps
     WHERE depot = ? AND (roName LIKE ? OR cmsCode LIKE ?)
     ORDER BY roName LIMIT ?`,
    [depot, q, q, limit]
  );
}

export async function getPump(id) {
  const d = await db();
  return d.getFirstAsync("SELECT * FROM pumps WHERE id = ?", [id]);
}
