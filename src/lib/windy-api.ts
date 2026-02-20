
'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Version 6.1 : Conformité totale au protocole JSON v2 (Typage Strict + Body Key + Referer Strict).
 */

export async function fetchWindyWeather(lat: number, lon: number) {
  // Clé Point Forecast
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  
  // URL EXACTE DE PRODUCTION (Doit correspondre à la console Windy)
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // PILIER 1 : TYPAGE NUMÉRIQUE STRICT
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // PILIER 2 : STRUCTURE JSON V2 (Body Injection)
    // La clé API DOIT être dans le corps JSON pour le Point Forecast v2.
    // PILIER 3 : DÉNOMINATION (lon et non lng)
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind', 'temp', 'waves'],
      levels: ['surface'],
      key: API_KEY
    };

    console.log("[Windy API v2] Payload envoi :", JSON.stringify(requestBody));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // PILIER 4 : REFERER DE VALIDATION
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Payload rejeté. Détails :", errorText);
        return { success: false, error: "Format JSON invalide (400)", status: 400 };
    }

    if (response.status === 401) {
        return { success: false, error: "Non autorisé (401). Vérifiez l'origine dans la console Windy.", status: 401 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
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
