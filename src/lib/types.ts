export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface WeatherData {
  wind: {
    speed: number;
    direction: WindDirection;
    stability: 'Stable' | 'Tournant';
  };
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
}

export interface FishRating {
  name: string;
  rating: number; // 1 to 10
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

export interface LocationData {
  weather: WeatherData;
  tides: Tide[];
  farming: FarmingData;
  fishing: FishingSlot[];
  hunting: HuntingData;
}
