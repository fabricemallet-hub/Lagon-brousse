'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution Erreur 400 : Mise en conformité stricte au protocole JSON v2.
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // PILIER 1 : TYPAGE NUMÉRIQUE STRICT (AUCUN GUILLEMET DANS LE JSON)
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // PILIER 2 : STRUCTURE JSON V2 CONFORME
    // La clé doit être dans le corps pour Point Forecast v2
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind', 'temp', 'waves'],
      levels: ['surface'],
      key: API_KEY
    };

    console.log("[Windy API] Payload sortant :", JSON.stringify(requestBody));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Détails rejet :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Extraction des données (index 0 correspondant au temps réel)
    const windRaw = data.wind?.[0] ?? 0;
    const tempK = data.temp?.[0] ?? 273.15;
    const wavesM = data.waves?.[0] ?? 0;

    return {
      windSpeed: Math.round(windRaw * 1.94384), // m/s -> knots
      temperature: Math.round(tempK - 273.15), // K -> Celsius
      waves: parseFloat(wavesM.toFixed(1)),
      success: true,
      status: 200
    };
  } catch (error: any) {
    console.error("[Windy API] Échec critique :", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
