
import { LocationData, SwellForecast, Tide, WindDirection, WindForecast, HourlyForecast } from './types';
import { locations } from './locations';
import { Firestore, doc, getDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

// Cache simple pour éviter les calculs procéduraux redondants
const proceduralCache = new Map<string, LocationData>();

/**
 * STATIONS DE RÉFÉRENCE
 * Ces données servent de base moyenne pour les calculs.
 * Elles sont basées sur les constantes harmoniques des ports de NC.
 */
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

/**
 * MAPPING COMMUNE -> STATION
 * Définit quelle station de référence est la plus proche géographiquement.
 */
export const communeToTideStationMap: { [key: string]: string } = {
  'Bélep': 'Koumac', 'Boulouparis': 'Nouméa', 'Bourail': 'Bourail', 'Canala': 'Thio',
  'Dumbéa': 'Nouméa', 'Farino': 'Bourail', 'Hienghène': 'Hienghène', 'Houaïlou': 'Hienghène',
  "L'Île-des-Pins": 'Nouméa', 'Kaala-Gomen': 'Koumac', 'Koné': 'Koné', 'Kouaoua': 'Thio',
  'Koumac': 'Koumac', 'La Foa': 'Bourail', 'Le Mont-Dore': 'Nouméa', 'Lifou': 'Ouvéa',
  'Maré': 'Ouvéa', 'Moindou': 'Bourail', 'Nouméa': 'Nouméa', 'Ouégoa': 'Koumac',
  'Ouvéa': 'Ouvéa', 'Païta': 'Nouméa', 'Poindimié': 'Hienghène', 'Ponérihouen': 'Hienghène',
  'Pouébo': 'Koumac', 'Pouembout': 'Koné', 'Poum': 'Koumac', 'Poya': 'Koné',
  'Sarraméa': 'Bourail', 'Thio': 'Thio', 'Voh': 'Koné', 'Yaté': 'Nouméa',
};

// Données de base par défaut
const baseData: Omit<LocationData, 'tides' | 'tideStation'> = {
  weather: {
    wind: [
      { time: '03:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '09:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '15:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '21:00', speed: 0, direction: 'N', stability: 'Stable' },
    ],
    swell: [],
    sun: { sunrise: '06:31', sunset: '17:45' },
    moon: { moonrise: '12:05', moonset: '23:55', phase: 'Premier quartier', percentage: 50 },
    rain: 'Aucune', trend: 'Ensoleillé', uvIndex: 7, temp: 26, tempMin: 23, tempMax: 33, waterTemperature: 24, hourly: [],
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

function getWindDirection(deg: number): WindDirection {
  const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
}

/**
 * LOGIQUE DE CALCUL DES MARÉES HORAIRES
 * Utilise une onde sinusoïdale pour lisser la courbe entre les pics de marée haute et basse.
 */
function calculateHourlyTides(location: string, baseDate: Date): Pick<HourlyForecast, 'date' | 'tideHeight' | 'tideCurrent' | 'tidePeakType'>[] {
    const getTidesForDay = (date: Date): Tide[] => {
        const dayOfMonth = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();
        const dateSeed = dayOfMonth + month * 31 + year * 365.25;
        const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const tideStation = communeToTideStationMap[location] || 'Nouméa';
        const stationTides = tideStations[tideStation as keyof typeof tideStations] || tideStations['Nouméa'];

        // Calcul de la phase lunaire pour l'amplitude (Vives-eaux / Mortes-eaux)
        const knownNewMoon = new Date('2024-01-11T00:00:00Z');
        const daysSinceKnownNewMoon = (date.getTime() - knownNewMoon.getTime()) / (1000 * 3600 * 24);
        const dayInCycle = daysSinceKnownNewMoon % 29.53;
        
        // Facteur d'amplitude : 1.0 aux quartiers, jusqu'à 1.3 à la pleine/nouvelle lune
        const springFactor = 1 + 0.3 * Math.abs(Math.cos((dayInCycle / 29.53) * 2 * Math.PI));

        const varyTime = (time: string, offset: number) => {
            let [h, m] = time.split(':').map(Number);
            m += Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
            if (m >= 60) { h = (h + 1) % 24; m %= 60; }
            if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        const dailyTides: Tide[] = JSON.parse(JSON.stringify(stationTides.tides));
        dailyTides.forEach((tide: Tide, i: number) => {
            const baseTide = stationTides.tides[i % stationTides.tides.length];
            const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * 0.05;
            
            if (tide.type === 'haute') {
                tide.height = parseFloat((baseTide.height * springFactor + variation).toFixed(2));
            } else {
                // Les marées basses sont plus basses lors des vives-eaux (haut springFactor)
                tide.height = parseFloat((baseTide.height / springFactor + variation).toFixed(2));
            }
            tide.time = varyTime(baseTide.time, i + 5);
        });
        return dailyTides;
    }

    const prevDate = new Date(baseDate);
    prevDate.setDate(baseDate.getDate() - 1);
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + 1);

    const tidesPrev = getTidesForDay(prevDate);
    const tidesToday = getTidesForDay(baseDate);
    const tidesNext = getTidesForDay(nextDate);

    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const allTideEvents = [
        ...tidesPrev.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time) - 24 * 60 })),
        ...tidesToday.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time) })),
        ...tidesNext.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time) + 24 * 60 })),
    ].sort((a, b) => a.timeMinutes - b.timeMinutes);

    const hourlyTides: Pick<HourlyForecast, 'date' | 'tideHeight' | 'tideCurrent' | 'tidePeakType'>[] = [];
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 48; i++) {
        const currentHourDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const totalMinutes = i * 60;

        let nextTideIndex = allTideEvents.findIndex(t => t.timeMinutes > totalMinutes);
        if (nextTideIndex === -1) nextTideIndex = allTideEvents.length - 1;
        let prevTideIndex = nextTideIndex > 0 ? nextTideIndex - 1 : 0;

        const prevTide = allTideEvents[prevTideIndex];
        const nextTide = allTideEvents[nextTideIndex];

        let tideHeight = prevTide.height;
        let tideCurrent: 'Nul' | 'Faible' | 'Modéré' | 'Fort' = 'Nul';
        let tidePeakType: 'haute' | 'basse' | undefined = undefined;

        const tideDuration = nextTide.timeMinutes - prevTide.timeMinutes;

        if (tideDuration > 0) {
            const timeSincePrevTide = totalMinutes - prevTide.timeMinutes;
            const phase = (timeSincePrevTide / tideDuration) * Math.PI;

            const amplitude = (prevTide.height - nextTide.height) / 2;
            const midline = (prevTide.height + nextTide.height) / 2;
            tideHeight = midline + amplitude * Math.cos(phase);

            const maxTideRange = Math.abs(prevTide.height - nextTide.height);
            const strengthValue = Math.abs(Math.sin(phase)) * maxTideRange;
            
            let closestPeak: (typeof allTideEvents[0]) | null = null;
            let minDiff = Infinity;
            allTideEvents.forEach(peak => {
                const diff = Math.abs(peak.timeMinutes - totalMinutes);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPeak = peak;
                }
            });

            if (minDiff < 45 && closestPeak) {
                tidePeakType = closestPeak.type;
            }

            if (strengthValue > 1.0) tideCurrent = 'Fort';
            else if (strengthValue > 0.5) tideCurrent = 'Modéré';
            else if (strengthValue > 0.1) tideCurrent = 'Faible';
            else {
                tideCurrent = 'Nul';
                if (!tidePeakType && closestPeak) {
                   tidePeakType = closestPeak.type
                }
            }
        }

        hourlyTides.push({
            date: currentHourDate.toISOString(),
            tideHeight: tideHeight,
            tideCurrent: tideCurrent,
            tidePeakType: tidePeakType
        });
    }

    return hourlyTides;
}

/**
 * GÉNÉRATEUR PROCÉDURAL PRINCIPAL
 * Calcule toutes les données météo, pêche et lune pour une date et un lieu donnés.
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

  // Création des "seeds" (graines) pour que le hasard soit prévisible pour un jour donné
  const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateSeed = dayOfMonth + month * 31 + year * 365.25;

  const varyTime = (time: string, offset: number) => {
    let [h, m] = time.split(':').map(Number);
    m += Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
    if (m >= 60) { h = (h + 1) % 24; m %= 60; }
    if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Calcul Phase Lunaire
  const phases: string[] = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const knownNewMoon = new Date('2024-01-11T00:00:00Z');
  const daysSinceKnownNewMoon = (effectiveDate.getTime() - knownNewMoon.getTime()) / (1000 * 3600 * 24);
  const dayInCycle = daysSinceKnownNewMoon % 29.53;
  const springFactor = 1 + 0.3 * Math.abs(Math.cos((dayInCycle / 29.53) * 2 * Math.PI));

  // 1. Déterminer la station de référence et récupérer les marées de base
  const tideStation = communeToTideStationMap[location] || 'Nouméa';
  const stationTides = tideStations[tideStation as keyof typeof tideStations] || tideStations['Nouméa'];

  // 2. Créer l'objet de données
  const locationData: LocationData = {
      ...JSON.parse(JSON.stringify(baseData)),
      tides: JSON.parse(JSON.stringify(stationTides.tides)),
      tideStation: tideStation
  };

  // Ajustement des marées selon le cycle lunaire (Amplitude)
  locationData.tides.forEach((tide: Tide, i: number) => {
    const baseTide = stationTides.tides[i % stationTides.tides.length];
    const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * 0.05;
    
    if (tide.type === 'haute') {
        tide.height = parseFloat((baseTide.height * springFactor + variation).toFixed(2));
    } else {
        // En vives-eaux, la basse mer est plus basse
        tide.height = parseFloat((baseTide.height / springFactor + variation).toFixed(2));
    }
    tide.time = varyTime(tide.time, i + 5);
  });
  
  const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
  };

  // Calcul du mouvement de marée pour chaque créneau de pêche
  locationData.fishing.forEach(slot => {
    const slotStartHour = parseInt(slot.timeOfDay.match(/(\d{2}):\d{2}/)![1]);
    const slotStartMinutes = slotStartHour * 60;

    let closestTide: Tide | null = null;
    let minDiff = Infinity;

    locationData.tides.forEach(tide => {
        const tideMinutes = timeToMinutes(tide.time);
        const diff = Math.abs(slotStartMinutes - tideMinutes);

        if (diff < minDiff) {
            minDiff = diff;
            closestTide = tide;
        }
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
             if (diff > 0 && diff < minNextDiff) {
                 minNextDiff = diff;
                 nextTide = tide;
             }
        });
        
        if (!nextTide) {
            let firstTideNextDay: Tide | null = null;
            let minFirstDiff = Infinity;
            locationData.tides.forEach(tide => {
                const tideMinutes = timeToMinutes(tide.time) + 24*60;
                const diff = tideMinutes - slotEndMinutes;
                if(diff > 0 && diff < minFirstDiff){
                    minFirstDiff = diff;
                    firstTideNextDay = tide;
                }
            });
            nextTide = firstTideNextDay;
        }

        if (minDiff < 30) {
            slot.tideMovement = 'étale';
        } else if (nextTide) {
            slot.tideMovement = nextTide.type === 'haute' ? 'montante' : 'descendante';
        } else {
             slot.tideMovement = 'étale';
        }
    }
  });
  
  const phaseIndex = Math.floor((dayInCycle / 29.53) * 8 + 0.5) % 8;
  locationData.weather.moon.phase = phases[phaseIndex];
  
  const illumination = 0.5 * (1 - Math.cos((dayInCycle / 29.53) * 2 * Math.PI));
  locationData.weather.moon.percentage = Math.round(illumination * 100);

  const warmSeasonMonths = [8, 9, 10, 11, 0, 1, 2, 3];
  const isPelagicSeason = warmSeasonMonths.includes(month);
  
  locationData.pelagicInfo = {
      inSeason: isPelagicSeason,
      message: isPelagicSeason
          ? 'La saison chaude bat son plein !'
          : 'Hors saison pour les grands pélagiques.'
  };

  // Calcul des indices de pêche (1 à 10)
  locationData.fishing.forEach((slot) => {
    slot.fish.forEach((f) => {
      let rating = 1;
      if (slot.timeOfDay.includes('Aube') || slot.timeOfDay.includes('Crépuscule')) rating += 3.5;
      else rating -= 2;
      
      if (slot.tideMovement !== 'étale') rating += 3.5;
      else rating -= 6;
      
      const isNearNewOrFullMoon = (dayInCycle < 4 || dayInCycle > 25.5) || (dayInCycle > 10.75 && dayInCycle < 18.75);
      if (isNearNewOrFullMoon) rating += 3.5;

      const randomFactor = Math.sin(dateSeed * 0.1 + locationSeed * 0.05 + slot.timeOfDay.length);
      rating += randomFactor;
      f.rating = Math.max(1, Math.min(10, Math.round(rating)));
    });
  });

  // Simulation du vent
  locationData.weather.wind.forEach((forecast: WindForecast, index: number) => {
    forecast.speed = Math.max(0, Math.round(8 + Math.sin(dateSeed * 0.2 + locationSeed + index) * 5));
    const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    forecast.direction = directions[Math.floor(((dateSeed / 5) + locationSeed + index * 2) % directions.length)];
    forecast.stability = (Math.sin(dateSeed + index) > 0) ? 'Stable' : 'Tournant';
  });

  // Simulation de la pluie et UV
  const rainChance = (Math.sin(dateSeed * 0.4 + locationSeed * 0.2) + 1) / 2;
  locationData.weather.rain = rainChance < 0.98 ? 'Aucune' : (rainChance < 0.995 ? 'Fine' : 'Forte');
  
  // Farming logic (Lune montante/descendante)
  const lunarPhase = dayInCycle < 14.76 ? 'Lune Montante' : 'Lune Descendante';
  locationData.farming.lunarPhase = lunarPhase;
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  const zodiac = zodiacSigns[Math.floor((dayInCycle / (27.3/4)) % 4)] as 'Fruits' | 'Racines' | 'Fleurs' | 'Feuilles';
  locationData.farming.zodiac = zodiac;

  // Ajout des données horaires
  const hourlyTideData = calculateHourlyTides(location, effectiveDate);
  locationData.weather.hourly = [];
  for (let i = 0; i < 24; i++) {
      const forecastDate = new Date(effectiveDate.getTime() + i * 60 * 60 * 1000);
      const t = hourlyTideData.find(td => new Date(td.date).getHours() === forecastDate.getHours());
      locationData.weather.hourly.push({
          date: forecastDate.toISOString(),
          condition: 'Ensoleillé',
          windSpeed: 10,
          windDirection: 'E',
          stability: 'Stable',
          isNight: i < 6 || i > 18,
          temp: 25,
          tideHeight: t?.tideHeight || 0,
          tideCurrent: t?.tideCurrent || 'Nul',
          tidePeakType: t?.tidePeakType
      });
  }

  proceduralCache.set(cacheKey, locationData);
  return locationData;
}

export function getDataForDate(location: string, date: Date): LocationData {
  return generateProceduralData(location, date);
}

export async function getTideArchiveStatus(firestore: Firestore): Promise<{ lastDate: string | null, stationCount: number }> {
    const stations = [...new Set(Object.values(communeToTideStationMap))];
    let latestDate: Date | null = null;
    for (const stationName of stations) {
        try {
            const tidesColRef = collection(firestore, `stations/${stationName}/tides`);
            const q = query(tidesColRef, orderBy('__name__', 'desc'), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const docDate = new Date(querySnapshot.docs[0].id);
                 if (!latestDate || docDate > latestDate) { latestDate = docDate; }
            }
        } catch (error) { console.error(`Failed to check tide archive for ${stationName}:`, error); }
    }
    return { lastDate: latestDate ? latestDate.toISOString().split('T')[0] : null, stationCount: stations.length };
}
