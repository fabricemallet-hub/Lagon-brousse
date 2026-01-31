import { LocationData, Tide, FishingSlot, FishRating, WindDirection, HuntingData, WindForecast } from './types';

const noumeaData: LocationData = {
  weather: {
    wind: [
      { time: '06:00', speed: 15, direction: 'SE', stability: 'Stable' },
      { time: '12:00', speed: 20, direction: 'S', stability: 'Stable' },
      { time: '18:00', speed: 12, direction: 'SE', stability: 'Tournant' },
    ],
    swell: {
      inside: '0.5m',
      outside: '1.2m',
      period: 8,
    },
    sun: {
      sunrise: '06:31',
      sunset: '17:45',
    },
    moon: {
      moonrise: '12:05',
      moonset: '23:55',
      phase: 'Premier quartier',
      percentage: 50,
    },
    rain: 'Aucune',
  },
  tides: [
    { type: 'basse', time: '04:15', height: 0.4, current: 'Modéré' },
    { type: 'haute', time: '10:30', height: 1.6, current: 'Fort' },
    { type: 'basse', time: '16:45', height: 0.5, current: 'Modéré' },
    { type: 'haute', time: '23:00', height: 1.5, current: 'Fort' },
  ],
  farming: {
    lunarPhase: 'Lune Montante',
    zodiac: 'Feuilles',
    recommendation: 'Planter des légumes feuilles, bouturer.',
    details: [
      {
        task: 'Plantation de légumes feuilles',
        description: 'La sève monte, idéal pour les salades, brèdes et choux.',
        icon: 'Leaf',
      },
      {
        task: 'Bouturage',
        description: 'Les boutures prennent plus facilement en lune montante.',
        icon: 'RefreshCw',
      },
      {
        task: 'Semis de fleurs',
        description: 'Profitez de cette phase pour semer vos fleurs annuelles.',
        icon: 'Flower',
      },
    ],
  },
  fishing: [
    {
      timeOfDay: 'Aube (05:00 - 07:00)',
      tide: 'Marée basse',
      tideTime: '04:15',
      tideMovement: 'montante',
      fish: [
        { name: 'Carangue', rating: 8 },
        { name: 'Mérou', rating: 7 },
        { name: 'Bec de cane', rating: 9 },
      ],
    },
    {
      timeOfDay: 'Matinée (09:00 - 11:00)',
      tide: 'Marée haute',
      tideTime: '10:30',
      tideMovement: 'descendante',
      fish: [
        { name: 'Poisson perroquet', rating: 6 },
        { name: 'Mulet', rating: 7 },
        { name: 'Loche', rating: 5 },
      ],
    },
    {
      timeOfDay: 'Après-midi (15:00 - 17:00)',
      tide: 'Marée basse',
      tideTime: '16:45',
      tideMovement: 'montante',
      fish: [
        { name: 'Dawa', rating: 8 },
        { name: 'Picot', rating: 6 },
        { name: 'Bonite', rating: 7 },
      ],
    },
    {
      timeOfDay: 'Crépuscule (17:30 - 19:00)',
      tide: 'Marée montante',
      tideTime: '19:00',
      tideMovement: 'montante',
      fish: [
        { name: 'Rouget', rating: 9 },
        { name: 'Vivaneau', rating: 8 },
        { name: 'Thon dents de chien', rating: 7 },
      ],
    },
  ],
  hunting: {
    period: {
        name: 'Normal',
        description: 'Activité normale des cerfs.'
    },
    advice: {
        rain: 'Temps sec, avancez silencieusement.',
        scent: 'Le vent stable facilite la gestion des odeurs.'
    }
  }
};

const data: Record<string, LocationData> = {
  Bélep: noumeaData,
  Boulouparis: noumeaData,
  Bourail: noumeaData,
  Canala: noumeaData,
  Dumbéa: noumeaData,
  Farino: noumeaData,
  Hienghène: noumeaData,
  Houaïlou: noumeaData,
  "L'Île-des-Pins": noumeaData,
  'Kaala-Gomen': noumeaData,
  Koné: {
    ...noumeaData,
    weather: {
      ...noumeaData.weather,
      wind: [
        { time: '06:00', speed: 18, direction: 'S', stability: 'Tournant' },
        { time: '12:00', speed: 22, direction: 'SW', stability: 'Tournant' },
        { time: '18:00', speed: 15, direction: 'S', stability: 'Stable' },
      ],
      swell: {
        inside: '0.6m',
        outside: '1.5m',
        period: 7,
      },
      sun: {
        sunrise: '06:35',
        sunset: '17:50',
      },
      moon: {
        moonrise: '12:10',
        moonset: '00:01',
        phase: 'Premier quartier',
        percentage: 50,
      },
      rain: 'Fine',
    },
    tides: [
      { type: 'basse', time: '04:30', height: 0.5, current: 'Modéré' },
      { type: 'haute', time: '10:45', height: 1.7, current: 'Fort' },
      { type: 'basse', time: '17:00', height: 0.6, current: 'Modéré' },
      { type: 'haute', time: '23:15', height: 1.6, current: 'Fort' },
    ],
    farming: {
      lunarPhase: 'Lune Descendante',
      zodiac: 'Racines',
      recommendation: 'Planter des légumes racines, tailler et désherber.',
      details: [
        {
          task: 'Plantation de légumes racines',
          description:
            'La sève descend, idéal pour ignames, manioc et carottes.',
          icon: 'Carrot',
        },
        {
          task: 'Taille des arbres',
          description:
            'La sève basse limite les écoulements et favorise la cicatrisation.',
          icon: 'Scissors',
        },
      ],
    },
  },
  Kouaoua: noumeaData,
  Koumac: noumeaData,
  'La Foa': noumeaData,
  'Le Mont-Dore': noumeaData,
  Lifou: noumeaData,
  Maré: noumeaData,
  Moindou: noumeaData,
  Nouméa: noumeaData,
  Ouégoa: noumeaData,
  Ouvéa: noumeaData,
  Païta: noumeaData,
  Poindimié: noumeaData,
  Ponérihouen: noumeaData,
  Pouébo: noumeaData,
  Pouembout: noumeaData,
  Poum: noumeaData,
  Poya: noumeaData,
  Sarraméa: noumeaData,
  Thio: {
    ...noumeaData,
    weather: {
      ...noumeaData.weather,
      wind: [
        { time: '06:00', speed: 12, direction: 'E', stability: 'Stable' },
        { time: '12:00', speed: 15, direction: 'E', stability: 'Stable' },
        { time: '18:00', speed: 10, direction: 'NE', stability: 'Stable' },
      ],
      swell: {
        inside: '0.4m',
        outside: '1.0m',
        period: 9,
      },
      sun: {
        sunrise: '06:29',
        sunset: '17:42',
      },
      moon: {
        moonrise: '12:03',
        moonset: '23:53',
        phase: 'Premier quartier',
        percentage: 50,
      },
      rain: 'Aucune',
    },
    tides: [
      { type: 'basse', time: '04:05', height: 0.3, current: 'Modéré' },
      { type: 'haute', time: '10:20', height: 1.5, current: 'Fort' },
      { type: 'basse', time: '16:35', height: 0.4, current: 'Modéré' },
      { type: 'haute', time: '22:50', height: 1.4, current: 'Fort' },
    ],
  },
  Touho: noumeaData,
  Voh: noumeaData,
  Yaté: noumeaData,
};

export function getDataForDate(location: string, date?: Date): LocationData {
  const effectiveDate = date || new Date();
  const dayOfMonth = effectiveDate.getDate();
  const month = effectiveDate.getMonth();
  const year = effectiveDate.getFullYear();

  // Create a deep copy to avoid modifying the original data object
  const baseData = data[location] || data['Nouméa'];
  const locationData: LocationData = JSON.parse(JSON.stringify(baseData));

  // Deterministically vary data based on the day of the month and location for prototype purposes
  const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateSeed = dayOfMonth + month * 31 + year * 365.25;

  // Vary Wind
  locationData.weather.wind.forEach((forecast: WindForecast, index: number) => {
    const baseForecast = (baseData.weather.wind[index] || baseData.weather.wind[0]);
    forecast.speed = Math.max(0, Math.round(baseForecast.speed + Math.sin(dateSeed * 0.2 + locationSeed + index) * 10));
    const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    forecast.direction = directions[Math.floor(((dateSeed / 5) + locationSeed + index * 2) % directions.length)];
    const windStabilities: ('Stable' | 'Tournant')[] = ['Stable', 'Tournant'];
    forecast.stability = windStabilities[Math.floor(((dateSeed / 2) + locationSeed + index) % windStabilities.length)];
  });

  // Vary Swell
  const swellBase = parseFloat((data[location] || data['Nouméa']).weather.swell.inside);
  locationData.weather.swell.inside = `${Math.max(0.1, swellBase + Math.sin(dateSeed * 0.3 + locationSeed * 0.1) * 0.5).toFixed(1)}m`;
  const swellOutsideBase = parseFloat((data[location] || data['Nouméa']).weather.swell.outside);
  locationData.weather.swell.outside = `${Math.max(0.2, swellOutsideBase + Math.cos(dateSeed * 0.3 + locationSeed * 0.1) * 1).toFixed(1)}m`;
  locationData.weather.swell.period = Math.max(4, Math.round(baseData.weather.swell.period + Math.sin(dateSeed * 0.1) * 3));

  // Vary Rain
  const rainConditions: ('Aucune' | 'Fine' | 'Forte')[] = ['Aucune', 'Fine', 'Forte'];
  const rainChance = (Math.sin(dateSeed * 0.4 + locationSeed * 0.2) + 1) / 2; // Normalize to 0-1
  if (rainChance < 0.5) {
      locationData.weather.rain = 'Aucune';
  } else if (rainChance < 0.8) {
      locationData.weather.rain = 'Fine';
  } else {
      locationData.weather.rain = 'Forte';
  }

  // Vary Sun/Moon times
  const timeVariation = (offset: number) => Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
  const varyTime = (time: string, offset: number) => {
    let [h, m] = time.split(':').map(Number);
    m += timeVariation(offset);
    if (m >= 60) { h = (h + 1) % 24; m %= 60; }
    if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  locationData.weather.sun.sunrise = varyTime(baseData.weather.sun.sunrise, 1);
  locationData.weather.sun.sunset = varyTime(baseData.weather.sun.sunset, 2);
  locationData.weather.moon.moonrise = varyTime(baseData.weather.moon.moonrise, 3);
  locationData.weather.moon.moonset = varyTime(baseData.weather.moon.moonset, 4);

  // Vary tides
  locationData.tides.forEach((tide: Tide, i: number) => {
    const baseTide = (data[location] || data['Nouméa']).tides[i];
    const variation = Math.sin((dateSeed + i) * 0.5 + locationSeed * 0.2) * 0.5;
    tide.height = parseFloat(Math.max(0.2, baseTide.height + variation).toFixed(1));
    tide.time = varyTime(baseTide.time, i + 5);
  });

  // Moon phase calculation
  const phases: string[] = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const knownNewMoon = new Date('2024-01-11T00:00:00Z');
  const daysSinceKnownNewMoon = (effectiveDate.getTime() - knownNewMoon.getTime()) / (1000 * 3600 * 24);
  const dayInCycle = daysSinceKnownNewMoon % 29.53;
  
  const phaseIndex = Math.floor((dayInCycle / 29.53) * 8 + 0.5) % 8;
  locationData.weather.moon.phase = phases[phaseIndex];
  
  const illumination = 0.5 * (1 - Math.cos((dayInCycle / 29.53) * 2 * Math.PI));
  locationData.weather.moon.percentage = Math.round(illumination * 100);

  // Farming data
  locationData.farming.lunarPhase = dayInCycle < 14.76 ? 'Lune Montante' : 'Lune Descendante';
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  locationData.farming.zodiac = zodiacSigns[Math.floor((dayInCycle / (27.3/4)) % 4)];

  // Fishing rating
  locationData.fishing.forEach((slot: FishingSlot) => {
    slot.fish.forEach((f: FishRating) => {
      const newRating = ((f.rating + dateSeed * 0.1 + locationSeed * 0.05 + f.name.length) % 8) + 2;
      f.rating = Math.max(1, Math.min(10, Math.round(newRating)));
    });
  });
  
  // Hunting data
  if (month >= 6 && month <= 7) { // July-August
    locationData.hunting.period = {
        name: 'Brame',
        description: 'Période de reproduction des cerfs. Les mâles sont moins méfiants et plus actifs, même en journée.'
    };
  } else if (month >= 1 && month <= 2) { // February-March
      locationData.hunting.period = {
          name: 'Chute des bois',
          description: 'Les cerfs mâles perdent leurs bois. Ils sont plus discrets et difficiles à repérer.'
      };
  } else {
      locationData.hunting.period = {
          name: 'Normal',
          description: 'Activité habituelle des cerfs, principalement à l\'aube et au crépuscule.'
      };
  }

  if (locationData.weather.rain === 'Fine') {
      locationData.hunting.advice.rain = 'Excellente condition, la pluie masque le bruit de vos pas.';
  } else if (locationData.weather.rain === 'Forte') {
      locationData.hunting.advice.rain = 'Chasse difficile, les animaux sont bloqués et peu mobiles.';
  } else {
      locationData.hunting.advice.rain = 'Temps sec, soyez particulièrement silencieux.';
  }

  const isWindUnstable = locationData.weather.wind.some(f => f.stability === 'Tournant');
  if (!isWindUnstable) {
      locationData.hunting.advice.scent = 'Le vent stable vous permet de bien gérer votre odeur. Chassez face au vent.';
  } else {
      locationData.hunting.advice.scent = 'Le vent tournant rend la gestion des odeurs très difficile. Redoublez de prudence.';
  }

  return locationData;
}

export function getAvailableLocations(): string[] {
  return Object.keys(data).sort();
}
