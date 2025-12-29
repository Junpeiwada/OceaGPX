import { TrackData, TrackPoint } from '../shared/types';

export interface ThinningResult {
  points: TrackPoint[];
  originalCount: number;
  exportedCount: number;
  intervalSeconds?: number;
}

// Thin out points to meet maxPoints limit using floating-point index method
export function thinPoints(points: TrackPoint[], maxPoints: number): ThinningResult {
  const originalCount = points.length;

  // If no limit or under limit, return as-is
  if (maxPoints <= 0 || points.length <= maxPoints) {
    return {
      points,
      originalCount,
      exportedCount: points.length,
    };
  }

  const result: TrackPoint[] = [];
  const interval = points.length / maxPoints;

  for (let i = 0; i < maxPoints - 1; i++) {
    const index = Math.floor(i * interval);
    result.push(points[index]);
  }

  // Always include the last point
  result.push(points[points.length - 1]);

  // Calculate approximate time interval
  let intervalSeconds: number | undefined;
  if (result.length >= 2) {
    const firstTime = new Date(result[0].time).getTime();
    const lastTime = new Date(result[result.length - 1].time).getTime();
    const totalSeconds = (lastTime - firstTime) / 1000;
    intervalSeconds = Math.round(totalSeconds / (result.length - 1));
  }

  return {
    points: result,
    originalCount,
    exportedCount: result.length,
    intervalSeconds,
  };
}

// Format date to ISO 8601 with UTC (convert local time to UTC)
function formatTime(dateStr: string): string {
  // Input format: "2021-10-09 08:58:49.000" (local time)
  // Output format: "2021-10-09T08:58:49Z" (UTC)
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate GPX track segment from points
function generateTrackSegment(points: TrackPoint[]): string {
  const trkpts = points.map((point) => {
    return `      <trkpt lat="${point.lat}" lon="${point.lon}">
        <time>${formatTime(point.time)}</time>
        <speed>${point.speed}</speed>
      </trkpt>`;
  }).join('\n');

  return `    <trkseg>
${trkpts}
    </trkseg>`;
}

// Generate GPX for a single track
function generateTrack(track: TrackData): string {
  const segment = generateTrackSegment(track.points);
  return `  <trk>
    <name>${escapeXml(track.name)}</name>
${segment}
  </trk>`;
}

// Generate complete GPX file content
export function generateGpx(tracks: TrackData[]): string {
  const tracksXml = tracks.map((track) => generateTrack(track)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OceaGPX"
     xmlns="http://www.topografix.com/GPX/1/1">
${tracksXml}
</gpx>`;
}

// Generate filename for single export
export function generateSingleFilename(track: TrackData): string {
  const startTime = track.points[0]?.time || '';
  const date = new Date(startTime);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;

  // Sanitize track name for filename
  const safeName = track.name.replace(/[<>:"/\\|?*]/g, '_');

  return `${safeName}_${dateStr}_${timeStr}.gpx`;
}

// Generate filename for merged export
export function generateMergedFilename(tracks: TrackData[]): string {
  if (tracks.length === 0) return 'tracks.gpx';

  // Get earliest start time and latest end time
  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;

  tracks.forEach((track) => {
    if (track.points.length > 0) {
      const start = new Date(track.points[0].time);
      const end = new Date(track.points[track.points.length - 1].time);

      if (!earliestStart || start < earliestStart) {
        earliestStart = start;
      }
      if (!latestEnd || end > latestEnd) {
        latestEnd = end;
      }
    }
  });

  if (!earliestStart || !latestEnd) return 'tracks.gpx';

  const startDate = earliestStart as Date;
  const endDate = latestEnd as Date;
  const startStr = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`;
  const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`;

  if (startStr === endStr) {
    return `tracks_${startStr}.gpx`;
  }

  return `tracks_${startStr}_${endStr}.gpx`;
}
