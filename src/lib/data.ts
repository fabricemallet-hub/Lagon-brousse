import { LocationData, Tide, FishingSlot, FishRating, WindDirection, HuntingData, WindForecast, HourlyForecast } from './types';

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
    trend: 'Ensoleillé',
    uvIndex: 7,
    temp: 26,
    tempMin: 23,
    tempMax: 33,
    hourly: [],
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
    isGoodForCuttings: false,
    isGoodForPruning: false,
    isGoodForMowing: false,
    sow: [],
    harvest: [],
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
      trend: 'Nuageux',
      uvIndex: 5,
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
      isGoodForCuttings: false,
      isGoodForPruning: false,
      isGoodForMowing: false,
      sow: [],
      harvest: [],
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
      trend: 'Ensoleillé',
      uvIndex: 8,
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
  if (rainChance < 0.6) {
      locationData.weather.rain = 'Aucune';
  } else if (rainChance < 0.85) {
      locationData.weather.rain = 'Fine';
  } else {
      locationData.weather.rain = 'Forte';
  }

  // Vary Trend and UV Index
  const uvSeed = (Math.sin(dateSeed * 0.25 + locationSeed * 0.15) + 1) / 2;
  locationData.weather.uvIndex = Math.round(1 + uvSeed * 10);

  if (locationData.weather.rain === 'Forte') {
      locationData.weather.trend = 'Pluvieux';
      locationData.weather.uvIndex = Math.min(locationData.weather.uvIndex, 2);
  } else if (locationData.weather.rain === 'Fine') {
      locationData.weather.trend = 'Averses';
      locationData.weather.uvIndex = Math.min(locationData.weather.uvIndex, 5);
  } else { // No rain
      if (locationData.weather.uvIndex > 7) {
          locationData.weather.trend = 'Ensoleillé';
      } else {
          locationData.weather.trend = 'Nuageux';
      }
  }
  locationData.weather.uvIndex = Math.max(1, Math.min(11, locationData.weather.uvIndex));


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
    const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * (baseTide.height * 0.5);
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
  const lunarPhase = dayInCycle < 14.76 ? 'Lune Montante' : 'Lune Descendante';
  locationData.farming.lunarPhase = lunarPhase;
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  const zodiac = zodiacSigns[Math.floor((dayInCycle / (27.3/4)) % 4)] as 'Fruits' | 'Racines' | 'Fleurs' | 'Feuilles';
  locationData.farming.zodiac = zodiac;

  locationData.farming.isGoodForCuttings = lunarPhase === 'Lune Montante';
  locationData.farming.isGoodForPruning = lunarPhase === 'Lune Descendante';
  locationData.farming.isGoodForMowing = lunarPhase === 'Lune Descendante' && zodiac === 'Feuilles';
  
  const sow: string[] = [];
  const harvest: string[] = [];

  // Hot season (Oct - Mar)
  if (month >= 9 || month <= 2) { // From October to March
    if (zodiac === 'Fruits') {
      sow.push('Tomates', 'Aubergines', 'Poivrons');
      harvest.push('Melons', 'Pastèques');
    }
    if (zodiac === 'Racines') {
      sow.push('Carottes', 'Radis');
      harvest.push('Patates douces', 'Manioc');
    }
    if (zodiac === 'Feuilles') {
      sow.push('Salades', 'Brèdes');
      harvest.push('Choux de Chine');
    }
    if (zodiac === 'Fleurs') {
        sow.push('Fleurs annuelles');
        harvest.push('Artichauts');
    }
  } 
  // Cool season (Apr - Sep)
  else { // From April to September
    if (zodiac === 'Fruits') {
      sow.push('Pois', 'Haricots');
      harvest.push('Citrouilles', 'Courgettes');
    }
    if (zodiac === 'Racines') {
      sow.push('Oignons', 'Ail', 'Poireaux');
      harvest.push('Carottes', 'Taro', 'Pommes de terre');
    }
    if (zodiac === 'Feuilles') {
      sow.push('Choux', 'Épinards', 'Bettes');
      harvest.push('Salades');
    }
     if (zodiac === 'Fleurs') {
        sow.push('Brocolis', 'Choux-fleurs');
    }
  }

  locationData.farming.sow = sow;
  locationData.farming.harvest = harvest;


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

    // Generate Hourly Forecasts
    locationData.weather.hourly = [];
    const startDate = new Date(effectiveDate);
    startDate.setMinutes(0,0,0);
    
    const baseTempMin = 22 + (locationSeed % 5);
    const baseTempMax = baseTempMin + 8 + (locationSeed % 3);

    for (let i = -2; i < 48; i++) { // next 48 hours
        const forecastDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const hour = forecastDate.getHours();
        const isNight = hour < 6 || hour > 19;
        
        const tempVariation = Math.sin((hour / 24) * Math.PI * 2 - Math.PI/2); // Sin wave for temp over 24h
        const temp = Math.round(baseTempMin + ((baseTempMax - baseTempMin) / 2) * (1 + tempVariation) + Math.sin(dateSeed+i/2)*2);

        const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const windDirection = directions[Math.floor((dateSeed/2 + hour/3 + locationSeed/100) % directions.length)];
        const windSpeed = Math.round(5 + Math.abs(Math.sin(dateSeed + hour/4 + locationSeed/1000)) * 25);

        let condition : HourlyForecast['condition'] = 'Ensoleillé';
        const conditionSeed = (Math.cos(dateSeed * 0.5 + i * 0.2 + locationSeed) + 1) / 2;
        if (isNight) {
            condition = conditionSeed > 0.6 ? 'Nuit claire' : 'Peu nuageux';
        } else {
            if (conditionSeed > 0.8) condition = 'Ensoleillé';
            else if (conditionSeed > 0.4) condition = 'Peu nuageux';
            else if (conditionSeed > 0.2) condition = 'Nuageux';
            else condition = 'Averses';
        }


        locationData.weather.hourly.push({
            date: forecastDate.toISOString(),
            condition: condition,
            windSpeed: windSpeed,
            windDirection: windDirection,
            isNight: isNight,
            temp: temp,
        });
    }

    const currentHourForecast = locationData.weather.hourly.find(f => new Date(f.date).getHours() === effectiveDate.getHours());
    locationData.weather.temp = currentHourForecast?.temp ?? baseData.weather.temp;
    locationData.weather.tempMin = Math.min(...locationData.weather.hourly.slice(0,24).map(f => f.temp));
    locationData.weather.tempMax = Math.max(...locationData.weather.hourly.slice(0,24).map(f => f.temp));


  return locationData;
}

export function getAvailableLocations(): string[] {
  return Object.keys(data).sort();
}
