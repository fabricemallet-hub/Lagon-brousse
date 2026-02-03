
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wind, Thermometer, Sun, MapPin, Search, ChevronLeft, CalendarDays, Waves, Info, BrainCircuit, ShieldAlert, Sparkles, CloudSun, Cloud, CloudRain, Moon, CloudMoon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState, useMemo, useEffect } from 'react';
import type { MeteoLive, LocationData, HourlyForecast } from '@/lib/types';
import { translateWindDirection } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { generateProceduralData } from '@/lib/data';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoonPhaseIcon } from '@/components/ui/lunar-calendar';
import { cn } from '@/lib/utils';
import { getWeatherSummary } from '@/ai/flows/weather-summary-flow';
import type { WeatherSummaryOutput } from '@/ai/schemas';
import { useLocation } from '@/context/location-context';
import { locations as locationsMap } from '@/lib/locations';

// Helper: Calculate distance between two points (Haversine)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const WeatherIcon = ({ condition, className }: { condition: string, className?: string }) => {
    const props = { className: cn('size-8', className) };
    switch (condition) {
        case 'Ensoleillé': return <Sun {...props} className={cn(props.className, "text-yellow-500")} />;
        case 'Peu nuageux': return <CloudSun {...props} className={cn(props.className, "text-orange-400")} />;
        case 'Nuageux': return <Cloud {...props} className={cn(props.className, "text-slate-400")} />;
        case 'Averses': return <CloudRain {...props} className={cn(props.className, "text-blue-400")} />;
        case 'Pluvieux': return <CloudRain {...props} className={cn(props.className, "text-blue-600")} />;
        case 'Nuit claire': return <Moon {...props} className={cn(props.className, "text-blue-200")} />;
        default: return <Sun {...props} />;
    }
};

export default function MeteoLivePage() {
  const firestore = useFirestore();
  const { selectedLocation } = useLocation();
  const [search, setSearch] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(null);
  
  const meteoQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meteo_caledonie');
  }, [firestore]);

  const { data: rawCommunes, isLoading } = useCollection<MeteoLive>(meteoQuery);

  const communes = useMemo(() => {
    if (!rawCommunes) return [];

    const isLoyaltyOrBelep = (id: string) => ['Bélep', 'Lifou', 'Maré', 'Ouvéa'].includes(id);
    const selectedCoords = locationsMap[selectedLocation];

    // Filter by search first
    const filtered = rawCommunes.filter(c => 
      c.id.toLowerCase().includes(search.toLowerCase())
    );

    // Sort by priority
    return [...filtered].sort((a, b) => {
      // 1. Current selected location always first
      if (a.id === selectedLocation) return -1;
      if (b.id === selectedLocation) return 1;

      // 2. Handle Loyalty Islands and Belep (at the end)
      const aSpecial = isLoyaltyOrBelep(a.id);
      const bSpecial = isLoyaltyOrBelep(b.id);
      
      if (aSpecial && !bSpecial) return 1;
      if (!aSpecial && bSpecial) return -1;
      
      // If both are special, sort alphabetically
      if (aSpecial && bSpecial) return a.id.localeCompare(b.id);

      // 3. Proximity sort for others
      if (!selectedCoords) return a.id.localeCompare(b.id);

      const posA = locationsMap[a.id];
      const posB = locationsMap[b.id];

      if (!posA || !posB) return a.id.localeCompare(b.id);

      const distA = getDistance(selectedCoords.lat, selectedCoords.lon, posA.lat, posA.lon);
      const distB = getDistance(selectedCoords.lat, selectedCoords.lon, posB.lat, posB.lon);

      return distA - distB;
    });
  }, [rawCommunes, selectedLocation, search]);

  if (selectedCommuneId) {
    const liveData = rawCommunes?.find(c => c.id === selectedCommuneId);
    return (
      <ForecastView 
        communeId={selectedCommuneId} 
        liveData={liveData} 
        onBack={() => setSelectedCommuneId(null)} 
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-12">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Sun className="text-primary size-7" /> Météo NC Live
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            Choisissez une commune pour voir les prévisions et l'analyse IA.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Rechercher une commune..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 border-2"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : communes && communes.length > 0 ? (
        <div className="flex flex-col gap-3">
          {communes.map((commune) => (
            <Card 
              key={commune.id} 
              className={cn(
                "overflow-hidden border-2 shadow-sm active:scale-[0.98] transition-transform cursor-pointer hover:border-primary/30",
                commune.id === selectedLocation && "border-primary/50 bg-primary/5"
              )}
              onClick={() => setSelectedCommuneId(commune.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                    commune.id === selectedLocation ? "bg-primary text-white" : "bg-primary/10 text-primary"
                  )}>
                    <MapPin className="size-7" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black uppercase tracking-tighter text-base leading-none truncate">{commune.id}</h3>
                      {commune.id === selectedLocation && (
                        <Badge variant="outline" className="text-[8px] h-4 font-black uppercase px-1.5 border-primary text-primary">Ma Commune</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      {/* Vent agrandi */}
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Wind className="size-4" />
                        <div className="flex flex-col leading-none">
                          <span className="text-base font-black">{commune.vent} <span className="text-[10px]">ND</span></span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase truncate">
                            {commune.direction ? translateWindDirection(commune.direction) : ''}
                          </span>
                        </div>
                      </div>
                      
                      {/* Température agrandie */}
                      <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 border-l border-border/50 pl-3">
                        <Thermometer className="size-4" />
                        <span className="text-base font-black">{commune.temperature}°C</span>
                      </div>

                      {/* Ajout de l'UV */}
                      <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500 border-l border-border/50 pl-3">
                        <Sun className="size-4" />
                        <span className="text-sm font-black">UV {commune.uv}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <ChevronLeft className="rotate-180 size-5 text-muted-foreground/30" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 border-4 border-dashed rounded-3xl flex flex-col items-center gap-4 opacity-40">
          <Sun className="size-12" />
          <p className="font-black uppercase tracking-widest text-xs">Aucune commune trouvée</p>
        </div>
      )}
    </div>
  );
}

function ForecastView({ communeId, liveData, onBack }: { communeId: string, liveData?: MeteoLive, onBack: () => void }) {
    const [aiSummary, setAiSummary] = useState<WeatherSummaryOutput | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const forecastDays = useMemo(() => {
        const days = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            const data = generateProceduralData(communeId, date);
            days.push({ date, data });
        }
        return days;
    }, [communeId]);

    useEffect(() => {
        const fetchSummary = async () => {
            setIsAiLoading(true);
            try {
                const summary = await getWeatherSummary({
                    commune: communeId,
                    forecasts: forecastDays.map(d => ({
                        date: format(d.date, 'EEEE d MMMM', { locale: fr }),
                        tempMin: d.data.weather.tempMin,
                        tempMax: d.data.weather.tempMax,
                        windSpeed: Math.max(...d.data.weather.wind.map(w => w.speed)),
                        windDirection: translateWindDirection(d.data.weather.wind[0].direction),
                        uvIndex: d.data.weather.uvIndex,
                        condition: d.data.weather.trend
                    }))
                });
                setAiSummary(summary);
            } catch (error) {
                console.error("AI Weather Summary error:", error);
            } finally {
                setIsAiLoading(false);
            }
        };
        fetchSummary();
    }, [communeId, forecastDays]);

    return (
        <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-12">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10">
                    <ChevronLeft className="size-6" />
                </Button>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <MapPin className="text-primary size-6" /> {communeId}
                </h1>
            </div>

            {/* Analyse IA en haut */}
            <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none shadow-xl overflow-hidden relative">
                <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
                    <BrainCircuit className="size-48" />
                </div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                        <Sparkles className="size-5 text-yellow-300" /> Bilan Assistant IA
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isAiLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full bg-white/20" />
                            <Skeleton className="h-4 w-3/4 bg-white/20" />
                            <Skeleton className="h-4 w-5/6 bg-white/20" />
                        </div>
                    ) : aiSummary ? (
                        <>
                            <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                                <p className="text-xs font-medium leading-relaxed italic">"{aiSummary.summary}"</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-blue-200 flex items-center gap-1">
                                        <Waves className="size-3" /> Activités Terroir
                                    </p>
                                    <p className="text-[11px] leading-tight opacity-90">{aiSummary.activities}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-orange-200 flex items-center gap-1">
                                        <ShieldAlert className="size-3" /> Précautions
                                    </p>
                                    <p className="text-[11px] leading-tight opacity-90">{aiSummary.precautions}</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-xs opacity-60">Analyse impossible pour le moment.</p>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                    <CalendarDays className="size-4" /> Évolution sur 7 jours
                </h3>
                
                <div className="flex flex-col gap-4">
                    {forecastDays.map(({ date, data }, index) => (
                        <DayForecastCard key={index} date={date} data={data} isToday={index === 0} liveData={index === 0 ? liveData : undefined} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function DayForecastCard({ date, data, isToday: today, liveData }: { date: Date, data: LocationData, isToday?: boolean, liveData?: MeteoLive }) {
    const { weather } = data;
    
    const tempMin = today && liveData ? Math.min(liveData.temperature, weather.tempMin) : weather.tempMin;
    const tempMax = today && liveData ? Math.max(liveData.temperature, weather.tempMax) : weather.tempMax;
    const windSpeed = today && liveData ? liveData.vent : Math.max(...weather.wind.map(w => w.speed));
    const windDir = today && liveData && liveData.direction ? translateWindDirection(liveData.direction) : translateWindDirection(weather.wind[0].direction);
    const uv = today && liveData ? liveData.uv : weather.uvIndex;

    // Détection de la première heure de pluie ou averses
    const rainForecast = weather.hourly.find(h => h.condition === 'Pluvieux' || h.condition === 'Averses');
    const rainTime = rainForecast ? format(new Date(rainForecast.date), 'HH:mm') : null;

    return (
        <Card className={cn("overflow-hidden border-2 shadow-sm", today && "border-primary/50 ring-1 ring-primary/20 bg-primary/5")}>
            <CardContent className="p-0">
                <div className="bg-muted/30 px-4 py-2 flex justify-between items-center border-b">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">{format(date, 'EEEE', { locale: fr })}</span>
                        <span className="font-black text-base">{format(date, 'd MMMM', { locale: fr })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {rainTime && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[9px] font-black animate-pulse">
                                Pluie à {rainTime}
                            </Badge>
                        )}
                        <WeatherIcon condition={weather.trend} />
                    </div>
                </div>

                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Thermometer className="size-3 text-orange-500" /> Températures
                        </p>
                        <p className="font-black text-sm">{tempMin}° / {tempMax}°C</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Wind className="size-3 text-blue-500" /> Vent Max
                        </p>
                        <div className="flex flex-col">
                            <p className="font-black text-sm">{windSpeed} ND</p>
                            <p className="text-[9px] font-bold text-muted-foreground italic">{windDir}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Sun className="size-3 text-yellow-500" /> Indice UV
                        </p>
                        <Badge className={cn("font-black h-6 px-3 text-xs text-white border-none shadow-sm", uv > 8 ? "bg-red-500" : uv > 5 ? "bg-orange-500" : "bg-green-500")}>
                            {uv}
                        </Badge>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Moon className="size-3 text-slate-500" /> Lune
                        </p>
                        <div className="flex items-center gap-2">
                            <MoonPhaseIcon phase={weather.moon.phase} className="size-4 text-slate-600" />
                            <span className="text-[10px] font-bold truncate max-w-[80px]">{weather.moon.phase}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
