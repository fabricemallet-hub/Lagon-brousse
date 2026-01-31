import { LocationData, Tide, FishingSlot, FishRating } from './types';

const noumeaData: LocationData = {
  weather: {
    wind: {
      speed: 15,
      direction: 'SE',
    },
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
    },
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
    weather: {
      wind: {
        speed: 18,
        direction: 'S',
      },
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
      },
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
    fishing: [
      {
        timeOfDay: 'Aube (05:00 - 07:00)',
        tide: 'Marée basse',
        tideTime: '04:30',
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
        tideTime: '10:45',
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
        tideTime: '17:00',
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
        tideTime: '19:15',
        tideMovement: 'montante',
        fish: [
          { name: 'Rouget', rating: 9 },
          { name: 'Vivaneau', rating: 8 },
          { name: 'Thon dents de chien', rating: 7 },
        ],
      },
    ],
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
    weather: {
      wind: {
        speed: 12,
        direction: 'E',
      },
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
      },
    },
    tides: [
      { type: 'basse', time: '04:05', height: 0.3, current: 'Modéré' },
      { type: 'haute', time: '10:20', height: 1.5, current: 'Fort' },
      { type: 'basse', time: '16:35', height: 0.4, current: 'Modéré' },
      { type: 'haute', time: '22:50', height: 1.4, current: 'Fort' },
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
      ],
    },
    fishing: [
      {
        timeOfDay: 'Aube (05:00 - 07:00)',
        tide: 'Marée basse',
        tideTime: '04:05',
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
        tideTime: '10:20',
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
        tideTime: '16:35',
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
        tideTime: '18:50',
        tideMovement: 'montante',
        fish: [
          { name: 'Rouget', rating: 9 },
          { name: 'Vivaneau', rating: 8 },
          { name: 'Thon dents de chien', rating: 7 },
        ],
      },
    ],
  },
  Touho: noumeaData,
  Voh: noumeaData,
  Yaté: noumeaData,
};

export function getDataForDate(location: string, date?: Date): LocationData {
  const effectiveDate = date || new Date();
  const dayOfMonth = effectiveDate.getDate();

  // Create a deep copy to avoid modifying the original data object
  const baseData = data[location] || data['Nouméa'];
  const locationData = JSON.parse(JSON.stringify(baseData));

  // Deterministically vary data based on the day of the month for prototype purposes
  
  // Vary tides slightly
  locationData.tides.forEach((tide: Tide, i: number) => {
    const variation = Math.sin((dayOfMonth + i) * 0.5) * 0.3;
    tide.height = parseFloat(Math.max(0.2, tide.height + variation).toFixed(1));
    const baseHour = parseInt(tide.time.split(':')[0]);
    const newHour = (baseHour + Math.floor(Math.sin(dayOfMonth + i) * 2)) % 24;
    tide.time = `${String(newHour < 0 ? 24 + newHour : newHour).padStart(2,'0')}:${tide.time.split(':')[1]}`;
  });

  // Vary moon phase
  const phases = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const phaseIndex = Math.floor((dayOfMonth / 30) * 8) % 8;
  locationData.weather.moon.phase = phases[phaseIndex];

  // Vary farming data
  locationData.farming.lunarPhase = dayOfMonth > 15 ? 'Lune Descendante' : 'Lune Montante';
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  locationData.farming.zodiac = zodiacSigns[Math.floor(dayOfMonth / 7) % 4];


  // Vary fishing rating
  locationData.fishing.forEach((slot: FishingSlot) => {
    slot.fish.forEach((f: FishRating) => {
      f.rating = Math.max(1, Math.min(10, ((f.rating + dayOfMonth * f.name.length) % 10) + 1));
    });
  });

  return locationData;
}

export function getAvailableLocations(): string[] {
  return Object.keys(data).sort();
}
