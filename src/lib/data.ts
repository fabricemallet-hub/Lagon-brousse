
import { LocationData, SwellForecast, Tide, WindDirection, WindForecast, HourlyForecast } from './types';
import { locations } from './locations';

// Cache simple pour éviter les calculs procéduraux redondants
const proceduralCache = new Map<string, LocationData>();

/**
 * STATIONS DE RÉFÉRENCE (Source: Météo NC / SHOM)
 * Données moyennes annuelles pour définir les seuils automatiques.
 */
const tideStations = {
  'Nouméa': {
    avgHigh: 1.45,
    avgLow: 0.35,
    tides: [
      { type: 'haute', time: '07:20', height: 1.45, current: 'Fort' },
      { type: 'basse', time: '13:45', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '19:30', height: 1.30, current: 'Fort' },
      { type: 'basse', time: '01:20', height: 0.40, current: 'Modéré' },
    ]
  },
  'Bourail': {
    avgHigh: 1.50,
    avgLow: 0.40,
    tides: [
      { type: 'haute', time: '08:40', height: 1.50, current: 'Fort' },
      { type: 'basse', time: '15:00', height: 0.40, current: 'Modéré' },
      { type: 'haute', time: '20:30', height: 1.35, current: 'Fort' },
      { type: 'basse', time: '02:00', height: 0.35, current: 'Modéré' },
    ]
  },
  'Koné': {
    avgHigh: 1.55,
    avgLow: 0.45,
    tides: [
      { type: 'haute', time: '10:30', height: 1.55, current: 'Fort' },
      { type: 'basse', time: '16:45', height: 0.45, current: 'Modéré' },
      { type: 'haute', time: '23:00', height: 1.45, current: 'Fort' },
      { type: 'basse', time: '04:15', height: 0.40, current: 'Modéré' },
    ]
  },
  'Thio': {
    avgHigh: 1.35,
    avgLow: 0.30,
    tides: [
      { type: 'haute', time: '10:10', height: 1.35, height_avg: 1.35, current: 'Fort' },
      { type: 'basse', time: '16:20', height: 0.30, height_avg: 0.30, current: 'Modéré' },
      { type: 'haute', time: '22:40', height: 1.25, height_avg: 1.25, current: 'Fort' },
      { type: 'basse', time: '03:50', height: 0.35, height_avg: 0.35, current: 'Modéré' },
    ]
  },
  'Koumac': {
    avgHigh: 1.65,
    avgLow: 0.50,
    tides: [
      { type: 'haute', time: '10:20', height: 1.65, current: 'Fort' },
      { type: 'basse', time: '17:00', height: 0.50, current: 'Modéré' },
      { type: 'haute', time: '22:50', height: 1.55, current: 'Fort' },
      { type: 'basse', time: '03:50', height: 0.45, current: 'Modéré' },
    ]
  },
  'Hienghène': {
    avgHigh: 1.20,
    avgLow: 0.30,
    tides: [
      { type: 'haute', time: '09:30', height: 1.20, current: 'Fort' },
      { type: 'basse', time: '15:45', height: 0.30, current: 'Modéré' },
      { type: 'haute', time: '21:40', height: 1.15, current: 'Fort' },
      { type: 'basse', time: '03:15', height: 0.35, current: 'Modéré' },
    ]
  },
  'Ouvéa': {
    avgHigh: 1.25,
    avgLow: 0.35,
    tides: [
      { type: 'haute', time: '09:00', height: 1.25, current: 'Fort' },
      { type: 'basse', time: '15:15', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '20:50', height: 1.15, current: 'Fort' },
      { type: 'basse', time: '02:30', height: 0.40, current: 'Modéré' },
    ]
  }
};

/**
 * MAPPING COMMUNE -> STATION
 */
export const communeToTideStationMap: { [key: string]: string } = {
  'Bélep': 'Koumac', 
  'Boulouparis': 'Nouméa', 
  'Bourail': 'Bourail', 
  'Canala': 'Thio',
  'Dumbéa': 'Nouméa', 
  'Farino': 'Bourail', 
  'Hienghène': 'Hienghène', 
  'Houaïlou': 'Thio',
  "L'Île-des-Pins": 'Nouméa', 
  'Kaala-Gomen': 'Koumac', 
  'Koné': 'Koné', 
  'Kouaoua': 'Thio',
  'Koumac': 'Koumac', 
  'La Foa': 'Bourail', 
  'Le Mont-Dore': 'Nouméa', 
  'Lifou': 'Ouvéa',
  'Maré': 'Ouvéa', 
  'Moindou': 'Bourail', 
  'Nouméa': 'Nouméa', 
  'Ouégoa': 'Koumac',
  'Ouvéa': 'Ouvéa', 
  'Païta': 'Nouméa', 
  'Poindimié': 'Hienghène', 
  'Ponérihouen': 'Hienghène',
  'Pouébo': 'Hienghène', 
  'Pouembout': 'Koné', 
  'Poum': 'Koumac', 
  'Poya': 'Koné',
  'Sarraméa': 'Bourail', 
  'Thio': 'Thio', 
  'Voh': 'Koné', 
  'Yaté': 'Nouméa',
};

// Données de base par défaut
const baseData: Omit<LocationData, 'tides' | 'tideStation' | 'tideThresholds'> = {
  weather: {
    wind: [
      { time: '03:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '09:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '15:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '21:00', speed: 0, direction: 'N', stability: 'Stable' },
    ],
    swell: [],
    sun: { sunrise: '06:31', sunset: '17:45' },
    moon: { moonrise: '12:05', moonset: '23:55', phase: 'Nouvelle lune', percentage: 0 },
    rain: 'Aucune', trend: 'Ensoleillé', uvIndex: 7, temp: 26, tempMin: 23, tempMax: 33, waterTemperature: 24, hourly: [],
  },
  farming: {
    lunarPhase: 'Lune Montante', zodiac: 'Feuilles', recommendation: '',
    details: [],
    isGoodForCuttings: false, isGoodForPruning: false, isGoodForMowing: false, sow: [], harvest: [],
  },
  fishing: [
    {
      timeOfDay: 'Aube (05:00 - 07:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Wahoo', rating: 9, location: 'Large', advice: { activity: 'Très forte activité à l\'aube.', feeding: 'Excellente heure.', location_specific: 'Tombants.', depth: 'Surface.' } },
        { name: 'Bec de cane', rating: 9, location: 'Lagon', advice: { activity: 'En bancs.', feeding: 'Très bonne heure.', location_specific: 'Platiers.', depth: '2-10m.' } },
      ],
    },
    {
      timeOfDay: 'Matinée (09:00 - 11:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Thon Jaune', rating: 6, location: 'Large', advice: { activity: 'Activité en baisse.', feeding: 'Moins prévisible.', location_specific: 'DCP.', depth: '20-50m.' } },
      ],
    },
    {
      timeOfDay: 'Après-midi (15:00 - 17:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Carangue', rating: 6, location: 'Lagon', advice: { activity: 'L\'activité reprend.', feeding: 'Bonne heure.', location_specific: 'Passes.', depth: 'Surface à 15m.' } },
      ],
    },
    {
      timeOfDay: 'Crépuscule (17:30 - 19:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Carangue', rating: 9, location: 'Lagon', advice: { activity: 'Très forte activité.', feeding: 'Excellente heure.', location_specific: 'Passes.', depth: 'Surface à 10m.' } },
      ],
    },
  ],
  hunting: {
    period: { name: 'Normal', description: 'Activité normale des cerfs.' },
    advice: { rain: 'Temps sec, avancez silencieusement.', scent: 'Le vent stable facilite la gestion des odeurs.' }
  },
  crabAndLobster: {
    crabStatus: 'Plein', crabMessage: '', lobsterActivity: 'Moyenne', lobsterMessage: '',
    octopusActivity: 'Moyenne', octopusMessage: ''
  }
};

/**
 * GÉNÉRATEUR PROCÉDURAL PRINCIPAL
 */
export function generateProceduralData(location: string, date: Date): LocationData {
  const dateKey = date.toISOString().split('T')[0];
  const cacheKey = `${location}-${dateKey}`;
  
  if (proceduralCache.has(cacheKey)) {
    return proceduralCache.get(cacheKey)!;
  }

  const effectiveDate = new Date(dateKey);
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

  const phases: string[] = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const knownNewMoon = new Date('2024-01-11T00:00:00Z');
  const daysSinceKnownNewMoon = (effectiveDate.getTime() - knownNewMoon.getTime()) / (1000 * 3600 * 24);
  const dayInCycle = daysSinceKnownNewMoon % 29.53;
  
  const springFactor = 1 + 0.28 * Math.abs(Math.cos((dayInCycle / 29.53) * 2 * Math.PI));

  const tideStationName = communeToTideStationMap[location] || 'Nouméa';
  const stationInfo = tideStations[tideStationName as keyof typeof tideStations] || tideStations['Nouméa'];

  const tideThresholds = {
    high: parseFloat((stationInfo.avgHigh * 1.15).toFixed(2)),
    low: parseFloat((stationInfo.avgLow * 0.65).toFixed(2)),
  };

  const locationData: LocationData = {
      ...JSON.parse(JSON.stringify(baseData)),
      tides: JSON.parse(JSON.stringify(stationInfo.tides)),
      tideStation: tideStationName,
      tideThresholds: tideThresholds
  };

  locationData.tides.forEach((tide: Tide, i: number) => {
    const baseTide = stationInfo.tides[i % stationInfo.tides.length];
    const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * 0.03;
    if (tide.type === 'haute') {
        tide.height = parseFloat((baseTide.height * springFactor + variation).toFixed(2));
    } else {
        tide.height = parseFloat((baseTide.height / springFactor + variation).toFixed(2));
    }
    tide.time = varyTime(baseTide.time, i + 5);
  });
  
  const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
  };

  locationData.fishing.forEach(slot => {
    const match = slot.timeOfDay.match(/(\d{2}):\d{2}/);
    if (!match) return;
    const slotStartHour = parseInt(match[1]);
    const slotStartMinutes = slotStartHour * 60;

    let closestTide: Tide | null = null;
    let minDiff = Infinity;

    locationData.tides.forEach(tide => {
        const tideMinutes = timeToMinutes(tide.time);
        const diff = Math.abs(slotStartMinutes - tideMinutes);
        if (diff < minDiff) { minDiff = diff; closestTide = tide; }
    });

    if (closestTide) {
        slot.tide = `Marée ${closestTide.type}`;
        slot.tideTime = closestTide.time;
        const slotEndMinutes = slotStartMinutes + 120;
        let nextTide: Tide | null = null;
        let minNextDiff = Infinity;

        locationData.tides.forEach(tide => {
             const tideMinutes = timeToMinutes(tide.time);
             const diff = tideMinutes - slotEndMinutes;
             if (diff > 0 && diff < minNextDiff) { minNextDiff = diff; nextTide = tide; }
        });
        
        if (minDiff < 30) { slot.tideMovement = 'étale'; } 
        else if (nextTide) { slot.tideMovement = nextTide.type === 'haute' ? 'montante' : 'descendante'; } 
        else { slot.tideMovement = 'étale'; }
    }
  });
  
  const phaseIndex = Math.floor((dayInCycle / 29.53) * 8 + 0.5) % 8;
  locationData.weather.moon.phase = phases[phaseIndex];
  locationData.weather.moon.percentage = Math.round(0.5 * (1 - Math.cos((dayInCycle / 29.53) * 2 * Math.PI)) * 100);

  const isPelagicSeason = [8, 9, 10, 11, 0, 1, 2, 3].includes(month);
  locationData.pelagicInfo = { inSeason: isPelagicSeason, message: isPelagicSeason ? 'Saison des pélagiques ouverte !' : 'Hors saison pélagiques.' };

  // --- Logique Crabes et Langoustes ---
  // Les crabes de palétuvier muent autour de la pleine lune (Cycle ~14.76)
  if (dayInCycle >= 12 && dayInCycle <= 18) {
    locationData.crabAndLobster.crabStatus = 'Mout';
    locationData.crabAndLobster.crabMessage = "Période de mue : les crabes sont 'mouts' (coque molle).";
  } else if (dayInCycle <= 4 || dayInCycle >= 25) {
    locationData.crabAndLobster.crabStatus = 'Plein';
    locationData.crabAndLobster.crabMessage = "Les crabes sont bien pleins et lourds.";
  } else {
    locationData.crabAndLobster.crabStatus = 'Vide';
    locationData.crabAndLobster.crabMessage = "Crabes en phase de remplissage.";
  }

  // Les langoustes sont plus actives par nuits sombres (Nouvelle lune)
  if (dayInCycle <= 5 || dayInCycle >= 24) {
    locationData.crabAndLobster.lobsterActivity = 'Élevée';
    locationData.crabAndLobster.lobsterMessage = "Nuits sombres : forte activité des langoustes au récif.";
  } else if (dayInCycle >= 12 && dayInCycle <= 18) {
    locationData.crabAndLobster.lobsterActivity = 'Faible';
    locationData.crabAndLobster.lobsterMessage = "Pleine lune : les langoustes sont peu actives dehors.";
  } else {
    locationData.crabAndLobster.lobsterActivity = 'Moyenne';
    locationData.crabAndLobster.lobsterMessage = "Activité modérée des langoustes.";
  }

  locationData.weather.wind.forEach((forecast: WindForecast, index: number) => {
    forecast.speed = Math.max(0, Math.round(8 + Math.sin(dateSeed * 0.2 + locationSeed + index) * 5));
    const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    forecast.direction = directions[Math.floor(((dateSeed / 5) + locationSeed + index * 2) % directions.length)];
    forecast.stability = (Math.sin(dateSeed + index) > 0) ? 'Stable' : 'Tournant';
  });

  const rainChance = (Math.sin(dateSeed * 0.4 + locationSeed * 0.2) + 1) / 2;
  locationData.weather.rain = rainChance < 0.98 ? 'Aucune' : (rainChance < 0.995 ? 'Fine' : 'Forte');
  
  const isRising = dayInCycle < 14.76;
  locationData.farming.lunarPhase = isRising ? 'Lune Montante' : 'Lune Descendante';
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  const currentZodiac = zodiacSigns[Math.floor((dayInCycle / (27.3/4)) % 4)] as any;
  locationData.farming.zodiac = currentZodiac;

  // Calcul dynamique des booleans de jardinage
  locationData.farming.isGoodForPruning = !isRising; // Taille en lune descendante
  locationData.farming.isGoodForCuttings = isRising; // Bouturage en lune montante (sève monte)
  locationData.farming.isGoodForMowing = !isRising; // Tonte en lune descendante pour freiner la repousse

  // Génération des recommandations
  if (isRising) {
    locationData.farming.recommendation = `Lune montante : la sève est active. Idéal pour le bouturage et la plantation des variétés ${currentZodiac}.`;
    locationData.farming.details = [
      { task: 'Bouturage', description: 'La sève monte, favorisant la prise des tiges.', icon: 'RefreshCw' },
      { task: `Semis ${currentZodiac}`, description: `Période favorable pour semer vos ${currentZodiac.toLowerCase()}.`, icon: 'Flower' }
    ];
  } else {
    locationData.farming.recommendation = `Lune descendante : la sève descend vers les racines. Idéal pour la taille, la tonte et les légumes ${currentZodiac}.`;
    locationData.farming.details = [
      { task: 'Taille', description: 'Réduit les pertes de sève et favorise la cicatrisation.', icon: 'Scissors' },
      { task: 'Tonte pelouse', description: 'La repousse sera plus lente et plus drue.', icon: 'Leaf' }
    ];
  }

  locationData.weather.hourly = [];
  const tideDataForDay = calculateHourlyTidesForSimulation(locationData.tides, date);
  
  for (let i = 0; i < 24; i++) {
      const forecastDate = new Date(effectiveDate.getTime() + i * 60 * 60 * 1000);
      const tideAtHour = tideDataForDay.find(td => new Date(td.date).getHours() === i);
      locationData.weather.hourly.push({
          date: forecastDate.toISOString(),
          condition: 'Ensoleillé',
          windSpeed: locationData.weather.wind[Math.floor(i/6)]?.speed || 10,
          windDirection: locationData.weather.wind[Math.floor(i/6)]?.direction || 'E',
          stability: locationData.weather.wind[Math.floor(i/6)]?.stability || 'Stable',
          isNight: i < 6 || i > 18,
          temp: 25,
          tideHeight: tideAtHour?.tideHeight || 0,
          tideCurrent: tideAtHour?.tideCurrent || 'Nul',
          tidePeakType: tideAtHour?.tidePeakType
      });
  }

  proceduralCache.set(cacheKey, locationData);
  return locationData;
}

function calculateHourlyTidesForSimulation(dailyTides: Tide[], baseDate: Date): any[] {
    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const sortedTides = [...dailyTides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const results = [];
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 24; i++) {
        const currentMinutes = i * 60;
        let prevTide = sortedTides.filter(t => timeToMinutes(t.time) <= currentMinutes).pop();
        let nextTide = sortedTides.find(t => timeToMinutes(t.time) > currentMinutes);

        if (!prevTide) prevTide = { ...sortedTides[sortedTides.length - 1], time: '00:00' };
        if (!nextTide) nextTide = { ...sortedTides[0], time: '23:59' };

        const duration = timeToMinutes(nextTide.time) - timeToMinutes(prevTide.time);
        const elapsed = currentMinutes - timeToMinutes(prevTide.time);
        const phase = duration > 0 ? (elapsed / duration) * Math.PI : 0;

        const amplitude = (prevTide.height - nextTide.height) / 2;
        const midline = (prevTide.height + nextTide.height) / 2;
        const height = midline + amplitude * Math.cos(phase);

        results.push({
            date: new Date(startDate.getTime() + i * 60 * 60 * 1000).toISOString(),
            tideHeight: height,
            tideCurrent: Math.abs(Math.sin(phase)) > 0.7 ? 'Fort' : 'Modéré',
            tidePeakType: Math.abs(currentMinutes - timeToMinutes(prevTide.time)) < 45 ? prevTide.type : undefined
        });
    }
    return results;
}

export function getDataForDate(location: string, date: Date): LocationData {
  return generateProceduralData(location, date);
}
