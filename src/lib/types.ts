export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface WindForecast {
  time: string;
  speed: number;
  direction: WindDirection;
  stability: 'Stable' | 'Tournant';
}

export interface HourlyForecast {
  date: string; // ISO string
  condition:
    | 'Peu nuageux'
    | 'Ensoleillé'
    | 'Nuageux'
    | 'Averses'
    | 'Pluvieux'
    | 'Nuit claire';
  windSpeed: number; // in knots
  windDirection: WindDirection;
  stability: 'Stable' | 'Tournant';
  isNight: boolean;
  temp: number;
  tideHeight: number;
  tideCurrent: 'Nul' | 'Faible' | 'Modéré' | 'Fort';
  tidePeakType?: 'haute' | 'basse';
}

export interface WeatherData {
  wind: WindForecast[];
  swell: {
    inside: string;
    outside: string;
    period: number;
  };
  sun: {
    sunrise: string;
    sunset: string;
  };
  moon: {
    moonrise: string;
    moonset: string;
    phase: string;
    percentage: number;
  };
  rain: 'Aucune' | 'Fine' | 'Forte';
  trend: 'Ensoleillé' | 'Nuageux' | 'Averses' | 'Pluvieux';
  uvIndex: number;
  temp: number;
  tempMin: number;
  tempMax: number;
  hourly: HourlyForecast[];
}

export interface Tide {
  type: 'haute' | 'basse';
  time: string;
  height: number;
  current: string;
}

export interface FarmingData {
  lunarPhase: 'Lune Montante' | 'Lune Descendante';
  zodiac: 'Fruits' | 'Fleurs' | 'Racines' | 'Feuilles';
  recommendation: string;
  details: {
    task: string;
    description: string;
    icon: 'Spade' | 'Scissors' | 'Flower' | 'Carrot' | 'Leaf' | 'RefreshCw';
  }[];
  isGoodForCuttings: boolean;
  isGoodForPruning: boolean;
  isGoodForMowing: boolean;
  sow: string[];
  harvest: string[];
}

export interface FishRating {
  name: string;
  rating: number; // 1 to 10
  location?: 'Lagon' | 'Large' | 'Mixte';
  advice: {
    activity: string;
    feeding: string;
    location_specific: string;
    depth: string;
  };
}

export interface FishingSlot {
  timeOfDay: string;
  tide: string;
  tideTime: string;
  tideMovement: 'montante' | 'descendante' | 'étale';
  fish: FishRating[];
}

export interface HuntingPeriod {
  name: 'Brame' | 'Chute des bois' | 'Normal';
  description: string;
}

export interface HuntingAdvice {
  rain: string;
  scent: string;
}

export interface HuntingData {
  period: HuntingPeriod;
  advice: HuntingAdvice;
}

export interface PelagicInfo {
  inSeason: boolean;
  message: string;
}

export interface CrabLobsterData {
  crabStatus: 'Plein' | 'Mout' | 'Vide';
  crabMessage: string;
  lobsterActivity: 'Élevée' | 'Moyenne' | 'Faible';
  lobsterMessage: string;
  octopusActivity: 'Élevée' | 'Moyenne' | 'Faible' | null;
  octopusMessage: string;
}

export interface LocationData {
  weather: WeatherData;
  tides: Tide[];
  farming: FarmingData;
  fishing: FishingSlot[];
  hunting: HuntingData;
  pelagicInfo?: PelagicInfo;
  crabAndLobster: CrabLobsterData;
  tideStation: string;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial' | 'admin';
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  favoriteLocationIds: string[];
}

export interface SessionParticipant {
  id: string; // user UID
  displayName: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  battery?: {
    level: number; // 0 to 1
    charging: boolean;
  };
  updatedAt: any; // Firestore ServerTimestamp
}

export interface HuntingSession {
  organizerId: string;
  createdAt: any; // Firestore ServerTimestamp
  expiresAt: any; // Firestore ServerTimestamp for TTL
}
