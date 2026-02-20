'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution Erreur 400 : Mise en conformité stricte (v5.1).
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // 1. DATA INTEGRITY (Piler 1) : Conversion en Number pur (sans guillemets)
    // Windy exige des types numériques. toFixed(6) est converti en Number.
    const cleanLat = Number(parseFloat(lat.toString()).toFixed(6));
    const cleanLon = Number(parseFloat(lon.toString()).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // 2. STRUCTURE JSON V2 STRICTE (Piler 2 & 3)
    // Utilisation de "lon" (et non lng) et inclusion de "key" dans le body.
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind', 'temp', 'waves'],
      levels: ['surface'],
      key: API_KEY
    };

    // Log diagnostic pour vérifier la structure exacte envoyée
    console.log("[Windy API v5.1] Payload JSON sortant :", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', // Piler 4
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    // 3. GESTION DES RÉPONSES (Piler 4)
    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Requête mal formée. Body envoyé :", JSON.stringify(requestBody));
        console.error("[Windy 400] Réponse serveur :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (response.status === 204) {
        console.warn("[Windy 204] Aucune donnée disponible pour ce point/modèle.");
        return { success: false, error: "Modèle sans données (204)", status: 204 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Windy renvoie des tableaux de prévisions horaires. Index 0 = actuel.
    const windRaw = data.wind?.[0] ?? 0;
    const tempK = data.temp?.[0] ?? 273.15;
    const wavesM = data.waves?.[0] ?? 0;

    return {
      windSpeed: Math.round(windRaw * 1.94384), // m/s to knots
      temperature: Math.round(tempK - 273.15), // K to Celsius
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
