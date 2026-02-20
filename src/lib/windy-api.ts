'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Version 4.9 : Support multi-paramètres (Vent/Temp) et formatage strict.
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // 1. DATA INTEGRITY : Conversion forcée en Number pur (Windy rejette les strings)
    const cleanLat = Number(parseFloat(lat.toString()).toFixed(6));
    const cleanLon = Number(parseFloat(lon.toString()).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // 2. STRUCTURE JSON V2 STRICTE
    // La doc Point Forecast v2 exige la clé dans le body JSON.
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon, // Utilise lon et non lng
      model: 'gfs',
      parameters: ['wind', 'temp'],
      levels: ['surface'],
      key: API_KEY
    };

    console.log("[Windy API v4.9] Payload JSON :", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    // 3. GESTION DES RÉPONSES
    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Rejet structurel. Vérifier le JSON envoyé :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (response.status === 204) {
        console.warn("[Windy 204] Aucune donnée disponible pour ces paramètres.");
        return { success: false, error: "Aucune donnée (204)", status: 204 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Windy renvoie des tableaux de prévisions horaires. Index 0 = actuel.
    // Conversion m/s en Noeuds (nds) : 1 m/s = 1.94384 nds
    // Conversion Kelvin en Celsius : K - 273.15
    const windRaw = data.wind?.[0] ?? 0;
    const tempK = data.temp?.[0] ?? 273.15;

    return {
      windSpeed: Math.round(windRaw * 1.94384),
      temperature: Math.round(tempK - 273.15),
      success: true,
      status: 200
    };
  } catch (error: any) {
    console.error("[Windy Critical] Failure:", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
