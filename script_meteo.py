import firebase_admin
from firebase_admin import credentials, firestore
import requests

# 1. Connexion à Tablo
cred = credentials.Certificate("service_account.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

# 2. Vos 33 communes
communes = {
    "Belep": {"lat": -19.72, "lon": 163.66}, "Boulouparis": {"lat": -21.87, "lon": 166.05},
    "Bourail": {"lat": -21.57, "lon": 165.49}, "Canala": {"lat": -21.52, "lon": 165.96},
    "Dumbéa": {"lat": -22.15, "lon": 166.45}, "Farino": {"lat": -21.65, "lon": 165.77},
    "Hienghène": {"lat": -20.68, "lon": 164.93}, "Houaïlou": {"lat": -21.28, "lon": 165.62},
    "Île des Pins": {"lat": -22.61, "lon": 167.45}, "Kaala-Gomen": {"lat": -20.67, "lon": 164.40},
    "Koné": {"lat": -21.06, "lon": 164.85}, "Kouaoua": {"lat": -21.40, "lon": 165.83},
    "Koumac": {"lat": -20.56, "lon": 164.28}, "La Foa": {"lat": -21.71, "lon": 165.83},
    "Lifou": {"lat": -20.92, "lon": 167.21}, "Maré": {"lat": -21.51, "lon": 167.93},
    "Moindou": {"lat": -21.69, "lon": 165.68}, "Mont-Dore": {"lat": -22.28, "lon": 166.58},
    "Nouméa": {"lat": -22.27, "lon": 166.44}, "Ouégoa": {"lat": -20.35, "lon": 164.43},
    "Ouvéa": {"lat": -20.64, "lon": 166.57}, "Païta": {"lat": -22.13, "lon": 166.36},
    "Poindimié": {"lat": -20.93, "lon": 165.33}, "Ponerihouen": {"lat": -21.07, "lon": 165.39},
    "Pouébo": {"lat": -20.40, "lon": 164.58}, "Pouembout": {"lat": -21.13, "lon": 164.90},
    "Poum": {"lat": -20.23, "lon": 164.02}, "Poya": {"lat": -21.35, "lon": 165.15},
    "Sarraméa": {"lat": -21.64, "lon": 165.85}, "Thio": {"lat": -21.61, "lon": 166.21},
    "Touho": {"lat": -20.79, "lon": 165.25}, "Voh": {"lat": -20.96, "lon": 164.70},
    "Yaté": {"lat": -22.12, "lon": 166.92}
}

print("🔄 Mise à jour Tablo : Mode Securisé...")

for nom, coord in communes.items():
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": coord["lat"],
            "longitude": coord["lon"],
            "current": "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,weather_code",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,precipitation_sum,precipitation_probability_max",
            "wind_speed_unit": "kn",
            "timezone": "Pacific/Noumea",
            "forecast_days": 14 # On demande plus pour etre sur d'avoir nos 7 jours
        }
        
        r = requests.get(url, params=params).json()

        # 1. Update Document Principal (Actuel)
        c = r["current"]
        db.collection("meteo_caledonie").document(nom).set({
            "temperature": c.get("temperature_2m"),
            "vent": c.get("wind_speed_10m"),
            "rafales": c.get("wind_gusts_10m"),
            "pression": c.get("pressure_msl"),
            "meteo": c.get("weather_code"),
            "derniere_maj": firestore.SERVER_TIMESTAMP
        }, merge=True)

        # 2. Update Sous-collection (J+1 à J+7)
        d = r["daily"]
        # On vérifie la taille réelle des données reçues pour ne pas planter
        nb_jours_dispos = len(d.get("time", []))
        
        for i in range(1, min(8, nb_jours_dispos)):
            day_id = "jour_" + str(i)
            db.collection("meteo_caledonie").document(nom).collection("previsions").document(day_id).set({
                "date": d["time"][i],
                "temp_max": d["temperature_2m_max"][i],
                "temp_min": d["temperature_2m_min"][i],
                "vent_max": d["wind_speed_10m_max"][i],
                "rafales_max": d["wind_gusts_10m_max"][i],
                "prob_pluie": d["precipitation_probability_max"][i],
                "code_meteo": d["weather_code"][i]
            })
        
        print("✅ " + nom + " : OK")

    except Exception as e:
        print("⚠️ Erreur sur " + nom + " : " + str(e))

print("\n✨ Tablo est à jour !")
