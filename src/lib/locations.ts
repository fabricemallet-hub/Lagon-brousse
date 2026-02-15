
import type { Region } from './types';

export const regions = ['CALEDONIE', 'TAHITI'] as const;

export const locationsByRegion: Record<Region, { [key: string]: { lat: number; lon: number } }> = {
  'CALEDONIE': {
    'Bélep': { lat: -19.70, lon: 163.66 },
    'Boulouparis': { lat: -21.86, lon: 165.99 },
    'Bourail': { lat: -21.56, lon: 165.48 },
    'Canala': { lat: -21.52, lon: 165.96 },
    'Dumbéa': { lat: -22.15, lon: 166.44 },
    'Farino': { lat: -21.64, lon: 165.77 },
    'Hienghène': { lat: -20.68, lon: 164.93 },
    'Houaïlou': { lat: -21.28, lon: 165.62 },
    'L\'Île-des-Pins': { lat: -22.64, lon: 167.48 },
    'Kaala-Gomen': { lat: -20.66, lon: 164.40 },
    'Koné': { lat: -21.05, lon: 164.86 },
    'Kouaoua': { lat: -21.39, lon: 165.82 },
    'Koumac': { lat: -20.56, lon: 164.28 },
    'La Foa': { lat: -21.71, lon: 165.82 },
    'Le Mont-Dore': { lat: -22.21, lon: 166.57 },
    'Lifou': { lat: -20.91, lon: 167.24 },
    'Maré': { lat: -21.48, lon: 167.98 },
    'Moindou': { lat: -21.69, lon: 165.68 },
    'Nouméa': { lat: -22.27, lon: 166.45 },
    'Ouégoa': { lat: -20.35, lon: 164.43 },
    'Ouvéa': { lat: -20.45, lon: 166.56 },
    'Païta': { lat: -22.13, lon: 166.35 },
    'Poindimié': { lat: -20.94, lon: 165.33 },
    'Ponérihouen': { lat: -21.09, lon: 165.40 },
    'Pouébo': { lat: -20.39, lon: 164.58 },
    'Pouembout': { lat: -21.13, lon: 164.90 },
    'Poum': { lat: -20.23, lon: 164.02 },
    'Poya': { lat: -21.34, lon: 165.15 },
    'Sarraméa': { lat: -21.63, lon: 165.84 },
    'Thio': { lat: -21.61, lon: 166.21 },
    'Voh': { lat: -20.96, lon: 164.70 },
    'Yaté': { lat: -22.15, lon: 166.93 },
  },
  'TAHITI': {
    'Papeete': { lat: -17.53, lon: -149.56 },
    'Faaa': { lat: -17.55, lon: -149.60 },
    'Punaauia': { lat: -17.63, lon: -149.60 },
    'Pirae': { lat: -17.53, lon: -149.54 },
    'Mahina': { lat: -17.50, lon: -149.48 },
    'Paea': { lat: -17.68, lon: -149.58 },
    'Papara': { lat: -17.75, lon: -149.48 },
    'Taravao': { lat: -17.73, lon: -149.30 },
    'Teahupoo': { lat: -17.84, lon: -149.26 },
    'Mataiea': { lat: -17.75, lon: -149.41 },
    'Papeari': { lat: -17.76, lon: -149.36 },
    'Afareaitu (Moorea)': { lat: -17.54, lon: -149.79 },
    'Papetoai (Moorea)': { lat: -17.49, lon: -149.87 },
    'Haapiti (Moorea)': { lat: -17.56, lon: -149.87 },
  }
};

export const locations = { ...locationsByRegion['CALEDONIE'], ...locationsByRegion['TAHITI'] };
