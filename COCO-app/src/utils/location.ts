import { Area } from '../types';

// Calculate distance between two points using Haversine formula
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Check if a point is inside a circular area
export const isPointInArea = (
  latitude: number,
  longitude: number,
  area: Area
): boolean => {
  const distance = calculateDistance(
    latitude,
    longitude,
    area.centerLatitude,
    area.centerLongitude
  );
  return distance <= area.radiusMeters;
};

// Find the smallest area that contains the point
export const findSmallestArea = (latitude: number, longitude: number, areas: Area[]): Area | null => {
  const containingAreas = areas.filter(area => isPointInArea(latitude, longitude, area));
  if (containingAreas.length === 0) return null;

  // Return area with smallest radius
  return containingAreas.reduce((smallest, current) =>
    current.radiusMeters < smallest.radiusMeters ? current : smallest
  );
};