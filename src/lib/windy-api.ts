'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution Erreur 400 : Mise en conformité stricte (v5.2).
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // PILLIER 1 : DATA INTEGRITY (Nombres purs sans guillemets)
    const cleanLat = Number(parseFloat(lat.toString()).toFixed(6));
    const cleanLon = Number(parseFloat(lon.toString()).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // PILLIER 2 & 3 : STRUCTURE JSON V2 & INJECTION CLÉ
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon, // Utilise lon et non lng
      model: 'gfs',
      parameters: ['wind', 'temp', 'waves'],
      levels: ['surface'],
      key: API_KEY // La clé DOIT être dans le body pour l'API Point Forecast v2
    };

    // Log diagnostic serveur
    console.log("[Windy API v5.2] Payload sortant :", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', // PILLIER 4 : Header obligatoire
        'Referer': PRODUCTION_URL, // Validation du domaine
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Échec :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (response.status === 204) {
        return { success: false, error: "Aucune donnée disponible (204)", status: 204 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Windy renvoie des tableaux de prévisions. Index 0 = actuel.
    const windRaw = data.wind?.[0] ?? 0;
    const tempK = data.temp?.[0] ?? 273.15;
    const wavesM = data.waves?.[0] ?? 0;

    return {
      windSpeed: Math.round(windRaw * 1.94384), // m/s en noeuds
      temperature: Math.round(tempK - 273.15), // K en Celsius
      waves: parseFloat(wavesM.toFixed(1)),
      success: true,
      status: 200,
      units: data.units || { wind: 'm/s', temp: 'K', waves: 'm' }
    };
  } catch (error: any) {
    console.error("[Windy Critical] Failure:", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
