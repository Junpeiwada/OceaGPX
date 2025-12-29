import Database from 'better-sqlite3';
import { RecordData, TrackData, TrackPoint } from '../shared/types';

export function loadRecordsFromDb(dbPath: string): RecordData[] {
  const db = new Database(dbPath, { readonly: true });

  try {
    const query = `
      SELECT
        L."LCHレコードID" as id,
        L."LCH記録名" as name,
        L."LCH開始時刻" as startTime,
        L."LCH終了時刻" as endTime,
        L."LCH航行距離" as distance,
        L."LCH表示F" as displayFlag,
        COUNT(O."LOCID") as pointCount
      FROM "LCHFIL" L
      LEFT JOIN "LOCFIL" O ON L."LCHレコードID" = O."LOCレコードID"
      GROUP BY L."LCHレコードID"
      ORDER BY L."LCH開始時刻" DESC
    `;

    const rows = db.prepare(query).all() as RecordData[];
    return rows;
  } finally {
    db.close();
  }
}

export function loadTracksFromDb(dbPath: string, recordIds: number[]): TrackData[] {
  const db = new Database(dbPath, { readonly: true });

  try {
    const tracks: TrackData[] = [];

    for (const recordId of recordIds) {
      // Get record name
      const recordQuery = `SELECT "LCH記録名" as name FROM "LCHFIL" WHERE "LCHレコードID" = ?`;
      const record = db.prepare(recordQuery).get(recordId) as { name: string } | undefined;

      if (!record) continue;

      // Get track points
      const pointsQuery = `
        SELECT
          "LOC緯度" as lat,
          "LOC経度" as lon,
          "LOC時刻" as time,
          "LOC速度" as speed
        FROM "LOCFIL"
        WHERE "LOCレコードID" = ?
        ORDER BY "LOC時刻" ASC
      `;

      const points = db.prepare(pointsQuery).all(recordId) as TrackPoint[];

      // Filter out invalid points (lat=0, lon=0)
      const validPoints = points.filter(p => p.lat !== 0 && p.lon !== 0);

      tracks.push({
        recordId,
        name: record.name,
        points: validPoints,
      });
    }

    return tracks;
  } finally {
    db.close();
  }
}
