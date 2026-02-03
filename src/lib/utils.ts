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
