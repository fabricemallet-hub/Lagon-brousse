
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Retourne l'heure actuelle ajustée à la région (Fuseau horaire).
 */
export function getRegionalNow(region: string): Date {
  const tz = region === 'TAHITI' ? 'Pacific/Tahiti' : 'Pacific/Noumea';
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  } catch (e) {
    return new Date();
  }
}

/**
 * Traduit les codes de direction du vent en français.
 */
export function translateWindDirection(direction: string): string {
  const map: Record<string, string> = {
    'N': 'Nord',
    'NE': 'Nord-Est',
    'E': 'Est',
    'SE': 'Sud-Est',
    'S': 'Sud',
    'SW': 'Sud-Ouest',
    'W': 'Ouest',
    'NW': 'Nord-Ouest',
  };
  return map[direction] || direction;
}

/**
 * Convertit des degrés (0-360) en direction cardinale française.
 */
export function degreesToCardinal(degrees: number | undefined): string {
  if (degrees === undefined) return 'N/A';
  const val = Math.floor((degrees / 22.5) + 0.5);
  const arr = ["Nord", "Nord-Est", "Nord-Est", "Est", "Est", "Sud-Est", "Sud-Est", "Sud", "Sud", "Sud-Ouest", "Sud-Ouest", "Ouest", "Ouest", "Nord-Ouest", "Nord-Ouest", "Nord"];
  return arr[(val % 16)];
}

/**
 * Mappe les codes météo numériques aux conditions textuelles.
 */
export function getMeteoCondition(code: number | undefined): string {
  if (code === undefined) return 'Ensoleillé';
  switch (code) {
    case 1: return 'Ensoleillé';
    case 2: return 'Peu nuageux';
    case 3: return 'Nuageux';
    case 4: return 'Couvert';
    case 5: return 'Averses';
    case 6: return 'Pluvieux';
    case 7: return 'Orageux';
    default: return 'Ensoleillé';
  }
}

/**
 * Calcule la distance entre deux points GPS (Haversine).
 */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calcule le gisement (bearing) entre deux points GPS.
 */
export const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
            Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  let brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
};

/**
 * Projette une position GPS (Dead Reckoning)
 */
export const calculateProjectedPosition = (
  lat: number,
  lng: number,
  speed: number, // en noeuds
  heading: number, // en degrés
  minutes: number
) => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const d = (speed * 0.514444) * (minutes * 60); // Distance en mètres (1 noeud = 0.514444 m/s)
  const brng = (heading * Math.PI) / 180; // Bearing en radians
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) +
    Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
    Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
};
