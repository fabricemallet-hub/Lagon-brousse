import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
