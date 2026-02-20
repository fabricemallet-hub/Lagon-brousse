'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution Erreur 400 & 401 : Mise en conformité stricte au protocole JSON v2.
 * @fileOverview Ce service gère les appels à l'API Point Forecast de Windy.
 */

export async function fetchWindyWeather(lat: number, lon: number) {
  // Clé Point Forecast (Spécifique aux données au point)
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // PILIER 1 : TYPAGE NUMÉRIQUE STRICT (AUCUN GUILLEMET DANS LE JSON FINAL)
    // On force la conversion en nombre pour éviter le rejet 400
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // PILIER 2 : STRUCTURE JSON V2 CONFORME
    // Pour Point Forecast v2, la clé "key" DOIT être dans le corps JSON.
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon, // Utilisation de lon et non lng
      model: 'gfs',
      parameters: ['wind', 'temp', 'waves'],
      levels: ['surface'],
      key: API_KEY
    };

    // Log diagnostic pour vérifier la structure exacte avant l'envoi
    console.log("[Windy API v2] Payload sortant :", JSON.stringify(requestBody));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Le Referer doit correspondre au domaine configuré dans la console Windy
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Requête rejetée (Bad Request). Détails :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (response.status === 401) {
        console.error("[Windy 401] Non autorisé. Vérifiez les restrictions de domaine sur api.windy.com/keys");
        return { success: false, error: "Non autorisé (401)", status: 401 };
    }

    if (response.status === 204) {
        return { success: false, error: "Pas de données pour ce modèle (204)", status: 204 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur HTTP ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Extraction des données (index 0 correspondant au temps réel ou le plus proche)
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
