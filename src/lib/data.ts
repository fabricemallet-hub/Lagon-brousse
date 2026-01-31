import { LocationData, Tide, WindDirection, WindForecast, HourlyForecast } from './types';

// Data from https://www.meteo.nc/nouvelle-caledonie/mer/previsions-site
const tideStations = {
  'Nouméa': {
    tides: [
      { type: 'haute', time: '07:23', height: 1.57, current: 'Fort' },
      { type: 'basse', time: '13:54', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '19:40', height: 1.39, current: 'Fort' },
      { type: 'basse', time: '01:31', height: 0.44, current: 'Modéré' },
    ]
  },
  'Bourail': {
    tides: [
      { type: 'haute', time: '08:55', height: 1.62, current: 'Fort' },
      { type: 'basse', time: '15:10', height: 0.59, current: 'Modéré' },
      { type: 'haute', time: '20:40', height: 1.32, current: 'Fort' },
      { type: 'basse', time: '02:05', height: 0.25, current: 'Modéré' },
    ]
  },
  'Koné': {
     tides: [
      { type: 'haute', time: '10:45', height: 1.7, current: 'Fort' },
      { type: 'basse', time: '17:00', height: 0.6, current: 'Modéré' },
      { type: 'haute', time: '23:15', height: 1.6, current: 'Fort' },
      { type: 'basse', time: '04:30', height: 0.5, current: 'Modéré' },
    ]
  },
  'Thio': {
    tides: [
      { type: 'haute', time: '10:20', height: 1.5, current: 'Fort' },
      { type: 'basse', time: '16:35', height: 0.4, current: 'Modéré' },
      { type: 'haute', time: '22:50', height: 1.4, current: 'Fort' },
      { type: 'basse', time: '04:05', height: 0.3, current: 'Modéré' },
    ]
  },
  'Koumac': {
    tides: [
      { type: 'haute', time: '10:30', height: 1.8, current: 'Fort' },
      { type: 'basse', time: '17:15', height: 0.7, current: 'Modéré' },
      { type: 'haute', time: '23:00', height: 1.7, current: 'Fort' },
      { type: 'basse', time: '04:00', height: 0.6, current: 'Modéré' },
    ]
  },
  'Hienghène': {
    tides: [
      { type: 'haute', time: '09:45', height: 1.3, current: 'Fort' },
      { type: 'basse', time: '16:00', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '21:50', height: 1.25, current: 'Fort' },
      { type: 'basse', time: '03:30', height: 0.4, current: 'Modéré' },
    ]
  },
  'Ouvéa': {
    tides: [
      { type: 'haute', time: '09:10', height: 1.4, current: 'Fort' },
      { type: 'basse', time: '15:30', height: 0.4, current: 'Modéré' },
      { type: 'haute', time: '21:00', height: 1.2, current: 'Fort' },
      { type: 'basse', time: '02:45', height: 0.5, current: 'Modéré' },
    ]
  }
};

const communeToTideStationMap: { [key: string]: string } = {
  'Bélep': 'Koumac', 'Boulouparis': 'Nouméa', 'Bourail': 'Bourail', 'Canala': 'Thio',
  'Dumbéa': 'Nouméa', 'Farino': 'Bourail', 'Hienghène': 'Hienghène', 'Houaïlou': 'Hienghène',
  "L'Île-des-Pins": 'Nouméa', 'Kaala-Gomen': 'Koumac', 'Koné': 'Koné', 'Kouaoua': 'Thio',
  'Koumac': 'Koumac', 'La Foa': 'Bourail', 'Le Mont-Dore': 'Nouméa', 'Lifou': 'Ouvéa',
  'Maré': 'Ouvéa', 'Moindou': 'Bourail', 'Nouméa': 'Nouméa', 'Ouégoa': 'Koumac',
  'Ouvéa': 'Ouvéa', 'Païta': 'Nouméa', 'Poindimié': 'Hienghène', 'Ponérihouen': 'Hienghène',
  'Pouébo': 'Koumac', 'Pouembout': 'Koné', 'Poum': 'Koumac', 'Poya': 'Koné',
  'Sarraméa': 'Bourail', 'Thio': 'Thio', 'Voh': 'Koné', 'Yaté': 'Nouméa',
};

// Base data for all locations, tides will be added dynamically.
const baseData: Omit<LocationData, 'tides' | 'tideStation'> = {
  weather: {
    wind: [
      { time: '06:00', speed: 15, direction: 'SE', stability: 'Stable' },
      { time: '12:00', speed: 20, direction: 'S', stability: 'Stable' },
      { time: '18:00', speed: 12, direction: 'SE', stability: 'Tournant' },
    ],
    swell: { inside: '0.5m', outside: '1.2m', period: 8 },
    sun: { sunrise: '06:31', sunset: '17:45' },
    moon: { moonrise: '12:05', moonset: '23:55', phase: 'Premier quartier', percentage: 50 },
    rain: 'Aucune', trend: 'Ensoleillé', uvIndex: 7, temp: 26, tempMin: 23, tempMax: 33, hourly: [],
  },
  farming: {
    lunarPhase: 'Lune Montante', zodiac: 'Feuilles', recommendation: 'Planter des légumes feuilles, bouturer.',
    details: [
      { task: 'Plantation de légumes feuilles', description: 'La sève monte, idéal pour les salades, brèdes et choux.', icon: 'Leaf' },
      { task: 'Bouturage', description: 'Les boutures prennent plus facilement en lune montante.', icon: 'RefreshCw' },
      { task: 'Semis de fleurs', description: 'Profitez de cette phase pour semer vos fleurs annuelles.', icon: 'Flower' },
    ],
    isGoodForCuttings: false, isGoodForPruning: false, isGoodForMowing: false, sow: [], harvest: [],
  },
  fishing: [
    {
      timeOfDay: 'Aube (05:00 - 07:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Carangue', rating: 8, location: 'Lagon' }, { name: 'Mérou', rating: 7, location: 'Lagon' },
        { name: 'Bec de cane', rating: 9, location: 'Lagon' },
      ],
    },
    {
      timeOfDay: 'Matinée (09:00 - 11:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Poisson perroquet', rating: 6, location: 'Lagon' }, { name: 'Wahoo', rating: 4, location: 'Large' },
        { name: 'Mahi-mahi', rating: 4, location: 'Large' },
      ],
    },
    {
      timeOfDay: 'Après-midi (15:00 - 17:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Thon Jaune', rating: 4, location: 'Large' }, { name: 'Thazard', rating: 5, location: 'Mixte' },
        { name: 'Bonite', rating: 7, location: 'Mixte' },
      ],
    },
    {
      timeOfDay: 'Crépuscule (17:30 - 19:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Rouget', rating: 9, location: 'Lagon' }, { name: 'Vivaneau', rating: 8, location: 'Lagon' },
        { name: 'Thon dents de chien', rating: 7, location: 'Large' },
      ],
    },
  ],
  hunting: {
    period: { name: 'Normal', description: 'Activité normale des cerfs.' },
    advice: { rain: 'Temps sec, avancez silencieusement.', scent: 'Le vent stable facilite la gestion des odeurs.' }
  },
  crabAndLobster: {
    crabStatus: 'Plein', crabMessage: '', lobsterActivity: 'Moyenne', lobsterMessage: ''
  }
};


export function getDataForDate(location: string, date?: Date): LocationData {
  const effectiveDate = date || new Date();
  const dayOfMonth = effectiveDate.getDate();
  const month = effectiveDate.getMonth();
  const year = effectiveDate.getFullYear();

  const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateSeed = dayOfMonth + month * 31 + year * 365.25;

  const varyTime = (time: string, offset: number) => {
    let [h, m] = time.split(':').map(Number);
    m += Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
    if (m >= 60) { h = (h + 1) % 24; m %= 60; }
    if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // 1. Determine tide station and get base tides
  const tideStation = communeToTideStationMap[location] || 'Nouméa';
  const stationTides = tideStations[tideStation as keyof typeof tideStations] || tideStations['Nouméa'];

  // 2. Create a deep copy of base data and add tides
  const locationData: LocationData = {
      ...JSON.parse(JSON.stringify(baseData)),
      tides: JSON.parse(JSON.stringify(stationTides.tides)),
      tideStation: tideStation
  };

  // Vary tides slightly for realism
  locationData.tides.forEach((tide: Tide, i: number) => {
    const baseTide = stationTides.tides[i % stationTides.tides.length];
    const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * (baseTide.height * 0.1); // Smaller variation
    tide.height = parseFloat(Math.max(0.1, baseTide.height + variation).toFixed(2));
    tide.time = varyTime(baseTide.time, i + 5);
  });
  
  const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
  };

  locationData.fishing.forEach(slot => {
    const slotStartHour = parseInt(slot.timeOfDay.match(/(\d{2}):\d{2}/)![1]);
    const slotStartMinutes = slotStartHour * 60;

    let precedingTide: Tide | null = null;
    let minDiff = Infinity;

    locationData.tides.forEach(tide => {
        const tideMinutes = timeToMinutes(tide.time);
        let diff = slotStartMinutes - tideMinutes;
        
        if (diff < 0) {
            diff += 24 * 60; 
        }

        if (diff < minDiff) {
            minDiff = diff;
            precedingTide = tide;
        }
    });

    if (precedingTide) {
        slot.tide = `Marée ${precedingTide.type}`;
        slot.tideTime = precedingTide.time;
        slot.tideMovement = precedingTide.type === 'basse' ? 'montante' : 'descendante';
    }
  });

  // Pelagic fish season logic
  const warmSeasonMonths = [8, 9, 10, 11, 0, 1, 2, 3]; // Sep to Apr
  const isPelagicSeason = warmSeasonMonths.includes(month);
  
  locationData.pelagicInfo = {
      inSeason: isPelagicSeason,
      message: isPelagicSeason
          ? 'La saison chaude bat son plein ! C\'est le meilleur moment pour cibler les pélagiques comme le thon, le mahi-mahi et le wahoo au large.'
          : 'Hors saison pour les grands pélagiques. Concentrez-vous sur les espèces de récif et de lagon.'
  };

  // Vary Wind
  locationData.weather.wind.forEach((forecast: WindForecast, index: number) => {
    forecast.speed = Math.max(0, Math.round(15 + Math.sin(dateSeed * 0.2 + locationSeed + index) * 10));
    const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    forecast.direction = directions[Math.floor(((dateSeed / 5) + locationSeed + index * 2) % directions.length)];
    const windStabilities: ('Stable' | 'Tournant')[] = ['Stable', 'Tournant'];
    forecast.stability = windStabilities[Math.floor(((dateSeed / 2) + locationSeed + index) % windStabilities.length)];
  });

  // Vary Swell
  const swellBase = 0.5;
  locationData.weather.swell.inside = `${Math.max(0.1, swellBase + Math.sin(dateSeed * 0.3 + locationSeed * 0.1) * 0.5).toFixed(1)}m`;
  const swellOutsideBase = 1.2;
  locationData.weather.swell.outside = `${Math.max(0.2, swellOutsideBase + Math.cos(dateSeed * 0.3 + locationSeed * 0.1) * 1).toFixed(1)}m`;
  locationData.weather.swell.period = Math.max(4, Math.round(8 + Math.sin(dateSeed * 0.1) * 3));

  // Vary Rain
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
  locationData.weather.sun.sunrise = varyTime(baseData.weather.sun.sunrise, 1);
  locationData.weather.sun.sunset = varyTime(baseData.weather.sun.sunset, 2);
  locationData.weather.moon.moonrise = varyTime(baseData.weather.moon.moonrise, 3);
  locationData.weather.moon.moonset = varyTime(baseData.weather.moon.moonset, 4);

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

  if (month >= 9 || month <= 2) { 
    if (zodiac === 'Fruits') { sow.push('Tomates', 'Aubergines', 'Poivrons'); harvest.push('Melons', 'Pastèques'); }
    if (zodiac === 'Racines') { sow.push('Carottes', 'Radis'); harvest.push('Patates douces', 'Manioc'); }
    if (zodiac === 'Feuilles') { sow.push('Salades', 'Brèdes'); harvest.push('Choux de Chine'); }
    if (zodiac === 'Fleurs') { sow.push('Fleurs annuelles'); harvest.push('Artichauts'); }
  } 
  else { 
    if (zodiac === 'Fruits') { sow.push('Pois', 'Haricots'); harvest.push('Citrouilles', 'Courgettes'); }
    if (zodiac === 'Racines') { sow.push('Oignons', 'Ail', 'Poireaux'); harvest.push('Carottes', 'Taro', 'Pommes de terre'); }
    if (zodiac === 'Feuilles') { sow.push('Choux', 'Épinards', 'Bettes'); harvest.push('Salades'); }
     if (zodiac === 'Fleurs') { sow.push('Brocolis', 'Choux-fleurs'); }
  }
  locationData.farming.sow = sow;
  locationData.farming.harvest = harvest;

  // Fishing rating
  locationData.fishing.forEach((slot) => {
    slot.fish.forEach((f) => {
      let baseRating = f.rating;
      if (isPelagicSeason && ['Mahi-mahi', 'Wahoo', 'Thon Jaune', 'Thazard'].includes(f.name)) {
          baseRating = 8; 
      } else if (!isPelagicSeason && ['Mahi-mahi', 'Wahoo', 'Thon Jaune', 'Thazard'].includes(f.name)) {
          baseRating = 3; 
      }
      const fishNameSeed = f.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const newRating = ((baseRating + dateSeed * 0.1 + locationSeed * 0.05 + fishNameSeed * 0.02) % 8) + 2;
      f.rating = Math.max(1, Math.min(10, Math.round(newRating)));
    });
  });
  
  // Hunting data
  if (month >= 6 && month <= 7) { 
    locationData.hunting.period = { name: 'Brame', description: 'Période de reproduction des cerfs. Les mâles sont moins méfiants et plus actifs, même en journée.' };
  } else if (month >= 1 && month <= 2) { 
      locationData.hunting.period = { name: 'Chute des bois', description: 'Les cerfs mâles perdent leurs bois. Ils sont plus discrets et difficiles à repérer.' };
  } else {
      locationData.hunting.period = { name: 'Normal', description: 'Activité habituelle des cerfs, principalement à l\'aube et au crépuscule.' };
  }
  if (locationData.weather.rain === 'Fine') { locationData.hunting.advice.rain = 'Excellente condition, la pluie masque le bruit de vos pas.'; } 
  else if (locationData.weather.rain === 'Forte') { locationData.hunting.advice.rain = 'Chasse difficile, les animaux sont bloqués et peu mobiles.'; } 
  else { locationData.hunting.advice.rain = 'Temps sec, soyez particulièrement silencieux.'; }
  const isWindUnstable = locationData.weather.wind.some(f => f.stability === 'Tournant');
  if (!isWindUnstable) { locationData.hunting.advice.scent = 'Le vent stable vous permet de bien gérer votre odeur. Chassez face au vent.'; } 
  else { locationData.hunting.advice.scent = 'Le vent tournant rend la gestion des odeurs très difficile. Redoublez de prudence.'; }

    // Generate Hourly Forecasts
    locationData.weather.hourly = [];
    const startDate = new Date(effectiveDate);
    startDate.setHours(0, 0, 0, 0);
    const baseTempMin = 22 + (locationSeed % 5);
    const baseTempMax = baseTempMin + 8 + (locationSeed % 3);
    for (let i = 0; i < 48; i++) {
        const forecastDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const hour = forecastDate.getHours();
        const isNight = hour < 6 || hour > 19;
        const tempVariation = Math.sin((hour / 24) * Math.PI * 2 - Math.PI/2);
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
        locationData.weather.hourly.push({ date: forecastDate.toISOString(), condition: condition, windSpeed: windSpeed, windDirection: windDirection, isNight: isNight, temp: temp });
    }
    const currentHourForecast = locationData.weather.hourly.find(f => new Date(f.date).getHours() === effectiveDate.getHours());
    if (currentHourForecast) { locationData.weather.temp = currentHourForecast.temp; }
    const dayForecasts = locationData.weather.hourly.slice(0, 24);
    if (dayForecasts.length > 0) {
      locationData.weather.tempMin = Math.min(...dayForecasts.map(f => f.temp));
      locationData.weather.tempMax = Math.max(...dayForecasts.map(f => f.temp));
    }

    // Crab and Lobster Data
    if (dayInCycle >= 27 || dayInCycle <= 3) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Plein', crabMessage: "Bonne période (nouvelle lune). Les crabes sont généralement pleins."};
    } else if (dayInCycle >= 12 && dayInCycle <= 18) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Plein', crabMessage: "Excellente période (pleine lune). Les crabes sont pleins et actifs."};
    } else if (dayInCycle > 3 && dayInCycle < 12) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Vide', crabMessage: "Période de 'crabes vides' (en mue). Moins intéressant pour la pêche."};
    } else {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Mout', crabMessage: "Période de 'crabes mous'. La qualité de la chair peut être moindre."};
    }
    if (illumination < 0.3) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, lobsterActivity: 'Élevée', lobsterMessage: "Nuits sombres, activité élevée. Privilégiez l'intérieur du lagon et les platiers."};
    } else if (illumination > 0.7) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, lobsterActivity: 'Faible', lobsterMessage: "Nuits claires, langoustes plus discrètes. Tentez votre chance à l'extérieur du récif ou plus en profondeur."};
    } else {
        locationData.crabAndLobster = {...locationData.crabAndLobster, lobsterActivity: 'Moyenne', lobsterMessage: "Activité moyenne. Pêche possible à l'intérieur et à l'extérieur du lagon."};
    }

  return locationData;
}

export function getAvailableLocations(): string[] {
  return Object.keys(communeToTideStationMap).sort();
}
