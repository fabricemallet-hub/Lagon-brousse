export interface WeatherData {
  wind: {
    speed: number;
    direction: string;
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
  };
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

export interface LocationData {
  weather: WeatherData;
  tides: Tide[];
  farming: FarmingData;
}
