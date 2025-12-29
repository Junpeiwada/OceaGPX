import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { LatLngBounds, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrackData } from '../../shared/types';

// Colors for different tracks
const TRACK_COLORS = [
  '#1976d2', // blue
  '#dc004e', // red
  '#388e3c', // green
  '#f57c00', // orange
  '#7b1fa2', // purple
  '#0097a7', // cyan
  '#c2185b', // pink
  '#512da8', // deep purple
];

// Douglas-Peucker algorithm for simplifying polylines
function simplifyTrack(
  points: { lat: number; lon: number }[],
  tolerance: number
): { lat: number; lon: number }[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyTrack(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyTrack(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: { lat: number; lon: number },
  lineStart: { lat: number; lon: number },
  lineEnd: { lat: number; lon: number }
): number {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.lon - lineStart.lon, 2) + Math.pow(point.lat - lineStart.lat, 2)
    );
  }

  const t = ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) / (dx * dx + dy * dy);
  const nearestLon = lineStart.lon + t * dx;
  const nearestLat = lineStart.lat + t * dy;

  return Math.sqrt(Math.pow(point.lon - nearestLon, 2) + Math.pow(point.lat - nearestLat, 2));
}

// Component to fit map bounds
interface FitBoundsProps {
  tracks: TrackData[];
}

const FitBounds: React.FC<FitBoundsProps> = ({ tracks }) => {
  const map = useMap();
  const prevTracksRef = useRef<string>('');

  useEffect(() => {
    const trackIds = tracks.map(t => t.recordId).sort().join(',');

    // Only fit bounds if tracks changed
    if (trackIds === prevTracksRef.current) return;
    prevTracksRef.current = trackIds;

    if (tracks.length === 0) return;

    const allPoints: LatLng[] = [];
    tracks.forEach((track) => {
      track.points.forEach((point) => {
        allPoints.push(new LatLng(point.lat, point.lon));
      });
    });

    if (allPoints.length > 0) {
      const bounds = new LatLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [tracks, map]);

  return null;
};

interface MapPreviewProps {
  tracks: TrackData[];
}

const MapPreview: React.FC<MapPreviewProps> = ({ tracks }) => {
  // Simplify tracks for rendering
  const simplifiedTracks = useMemo(() => {
    return tracks.map((track) => {
      // Tolerance based on point count (more points = more simplification)
      const tolerance = track.points.length > 10000 ? 0.0005 :
                       track.points.length > 5000 ? 0.0003 :
                       track.points.length > 1000 ? 0.0001 : 0;

      const simplified = tolerance > 0
        ? simplifyTrack(track.points, tolerance)
        : track.points;

      return {
        ...track,
        simplifiedPoints: simplified,
      };
    });
  }, [tracks]);

  // Default center (Japan)
  const defaultCenter: [number, number] = [35.6, 135.9];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {simplifiedTracks.map((track, index) => {
        const color = TRACK_COLORS[index % TRACK_COLORS.length];
        const positions: [number, number][] = track.simplifiedPoints.map((p) => [p.lat, p.lon]);

        if (positions.length === 0) return null;

        const startPoint = positions[0];
        const endPoint = positions[positions.length - 1];

        return (
          <React.Fragment key={track.recordId}>
            {/* Track polyline */}
            <Polyline
              positions={positions}
              color={color}
              weight={3}
              opacity={0.8}
            />

            {/* Start marker (green) */}
            <CircleMarker
              center={startPoint}
              radius={6}
              fillColor="#4caf50"
              fillOpacity={1}
              color="#fff"
              weight={2}
            />

            {/* End marker (red) */}
            <CircleMarker
              center={endPoint}
              radius={6}
              fillColor="#f44336"
              fillOpacity={1}
              color="#fff"
              weight={2}
            />
          </React.Fragment>
        );
      })}

      <FitBounds tracks={tracks} />
    </MapContainer>
  );
};

export default MapPreview;
