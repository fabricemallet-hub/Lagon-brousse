'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution Erreur 400 : Mise en conformité stricte (4 piliers v5.3).
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // PILLIER 1 : TYPAGE NUMÉRIQUE STRICT (Pas de guillemets dans le JSON final)
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // PILLIER 2 & 3 : STRUCTURE JSON V2 & INJECTION CLÉ DANS LE BODY
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon, // Utilise lon et non lng
      model: 'gfs',
      parameters: ['wind', 'temp', 'waves'],
      levels: ['surface'],
      key: API_KEY // La clé DOIT être dans le corps du JSON pour Point Forecast v2
    };

    // Diagnostic serveur
    console.log("[Windy API v5.3] Payload sortant :", JSON.stringify(requestBody));
    
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
        console.error("[Windy 400] Échec structure JSON :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (response.status === 204) {
        return { success: false, error: "Pas de données (204)", status: 204 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Extraction des données (index 0 pour le temps réel)
    const windRaw = data.wind?.[0] ?? 0;
    const tempK = data.temp?.[0] ?? 273.15;
    const wavesM = data.waves?.[0] ?? 0;

    return {
      windSpeed: Math.round(windRaw * 1.94384), // Conversion m/s -> noeuds
      temperature: Math.round(tempK - 273.15), // K -> Celsius
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
