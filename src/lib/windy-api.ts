
'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Version 6.5 : Support multi-paramètres (Vent, Rafales, Eau, Pression, Humidité).
 */

export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  
  // URL EXACTE DE PRODUCTION POUR LE REFERER
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind', 'gust', 'windDir', 'temp', 'pressure', 'rh', 'waves', 'sst'],
      levels: ['surface'],
      key: API_KEY 
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Extraction sécurisée des données selon le format v2 (Windy renvoie des tableaux)
    return {
      windSpeed: Math.round((data.wind?.[0] || 0) * 1.94384), // m/s -> knots
      gustSpeed: Math.round((data.gust?.[0] || 0) * 1.94384),
      windDir: data.windDir?.[0] || 0,
      temp: Math.round(data.temp?.[0] - 273.15), // Kelvin -> Celsius
      pressure: Math.round((data.pressure?.[0] || 0) / 100), // Pa -> hPa
      rh: data.rh?.[0] || 0, // Humidité %
      waves: parseFloat((data.waves?.[0] || 0).toFixed(1)),
      sst: data.sst ? Math.round(data.sst[0] - 273.15) : null, // Water Temp
      success: true,
      status: 200
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
