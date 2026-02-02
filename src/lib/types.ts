export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface WindForecast {
  time: string;
  speed: number;
  direction: WindDirection;
  stability: 'Stable' | 'Tournant';
}

export interface SwellForecast {
  time: string;
  inside: string;
  outside: string;
  period: number;
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
  swell: SwellForecast[];
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
  waterTemperature: number;
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
  mapIcon?: string;
  mapColor?: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial' | 'admin';
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  favoriteLocationIds?: string[];
}

export interface FishingSpot {
  id: string;
  userId: string;
  name: string;
  notes?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  icon: string;
  color: string;
  fishingTypes?: string[];
  createdAt: any; // Firestore ServerTimestamp
  context: {
    timestamp: string; // ISO string
    moonPhase: string;
    tideHeight: number;
    tideMovement: 'montante' | 'descendante' | 'étale';
    tideCurrent: 'Nul' | 'Faible' | 'Modéré' | 'Fort';
    weatherCondition: string;
    windSpeed: number;
    windDirection: WindDirection;
    airTemperature: number;
    waterTemperature: number;
    previousLowTide?: { time: string; height: number };
    nextHighTide?: { time: string; height: number };
  };
}

export interface SessionParticipant {
  id: string; // user UID
  displayName: string;
  mapIcon?: string;
  mapColor?: string;
  baseStatus?: 'En position' | 'Battue en cours';
  isGibierEnVue?: boolean;
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

export interface AccessToken {
  id: string;
  durationMonths: number;
  createdAt: any; // Firestore ServerTimestamp
  status: 'active' | 'redeemed';
  redeemedBy?: string;
  redeemedAt?: any; // Firestore ServerTimestamp
}

export interface Conversation {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  lastMessageContent: string;
  lastMessageAt: any; // Firestore ServerTimestamp
  isReadByAdmin: boolean;
  isReadByUser: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string; // user.uid or 'admin'
  content: string;
  createdAt: any; // Firestore ServerTimestamp
}
