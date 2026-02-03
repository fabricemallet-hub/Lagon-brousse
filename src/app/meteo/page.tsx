'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wind, Thermometer, Sun, MapPin, Search, ChevronLeft, CalendarDays, Waves, Info, BrainCircuit, ShieldAlert, Sparkles, CloudSun, Cloud, CloudRain, Moon, CloudMoon, ArrowUp, Droplets } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState, useMemo, useEffect } from 'react';
import type { MeteoLive, MeteoForecast, WindDirection } from '@/lib/types';
import { translateWindDirection, degreesToCardinal, getMeteoCondition } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { generateProceduralData } from '@/lib/data';
import { format } from 'date-fns';
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
        case 'Couvert': return <Cloud {...props} className={cn(props.className, "text-slate-600")} />;
        case 'Averses': return <CloudRain {...props} className={cn(props.className, "text-blue-400")} />;
        case 'Pluvieux': return <CloudRain {...props} className={cn(props.className, "text-blue-600")} />;
        case 'Nuit claire': return <Moon {...props} className={cn(props.className, "text-blue-200")} />;
        default: return <Sun {...props} />;
    }
};

const WindArrow = ({ direction, degrees, className }: { direction?: string, degrees?: number, className?: string }) => {
  const rotation = degrees !== undefined ? degrees : (
    {
      N: 0,
      NE: 45,
      E: 90,
      SE: 135,
      S: 180,
      SW: 225,
      W: 270,
      NW: 315,
    }[direction as WindDirection] || 0
  );

  return (
    <ArrowUp
      className={cn('size-4 text-blue-500 dark:text-blue-400', className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    />
  );
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

    const isLoyaltyOrBelep = (id: string) => {
        const normalized = id.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const special = ['belep', 'lifou', 'mare', 'ouvea'];
        return special.includes(normalized);
    };

    const selectedCoords = locationsMap[selectedLocation];

    const filtered = rawCommunes.filter(c => 
      c.id.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (a.id === selectedLocation) return -1;
      if (b.id === selectedLocation) return 1;

      const aSpecial = isLoyaltyOrBelep(a.id);
      const bSpecial = isLoyaltyOrBelep(b.id);
      
      if (aSpecial && !bSpecial) return 1;
      if (!aSpecial && bSpecial) return -1;
      if (aSpecial && bSpecial) return a.id.localeCompare(b.id);

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
            Données en direct de vos stations météo.
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
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Wind className="size-4" />
                        <div className="flex items-center gap-2 leading-none">
                          <span className="text-lg font-black whitespace-nowrap">
                            {commune.vent} <span className="text-[10px]">ND</span>
                          </span>
                          <div className="flex items-center gap-1.5 border-l border-border/50 pl-2">
                            <WindArrow degrees={commune.direction_vent} direction={commune.direction} className="size-4" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase whitespace-nowrap">
                              {commune.direction_vent !== undefined ? degreesToCardinal(commune.direction_vent) : translateWindDirection(commune.direction || 'N')}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 border-l border-border/50 pl-3">
                        <Thermometer className="size-4" />
                        <span className="text-lg font-black">{commune.temperature}°C</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500 border-l border-border/50 pl-3">
                        <Sun className="size-4" />
                        <span className="text-base font-black">UV {commune.uv}</span>
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
    const firestore = useFirestore();
    const [aiSummary, setAiSummary] = useState<WeatherSummaryOutput | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Fetch previsions from sub-collection
    const forecastQuery = useMemoFirebase(() => {
        if (!firestore || !communeId) return null;
        return query(collection(firestore, 'meteo_caledonie', communeId, 'previsions'), orderBy('date', 'asc'));
    }, [firestore, communeId]);

    const { data: dbForecasts, isLoading: isForecastsLoading } = useCollection<MeteoForecast>(forecastQuery);

    useEffect(() => {
        if (!dbForecasts || dbForecasts.length === 0) return;

        const fetchSummary = async () => {
            setIsAiLoading(true);
            try {
                const summary = await getWeatherSummary({
                    commune: communeId,
                    forecasts: dbForecasts.map(d => ({
                        date: format(new Date(d.date.replace(/-/g, '/')), 'EEEE d MMMM', { locale: fr }),
                        tempMin: d.temp_min,
                        tempMax: d.temp_max,
                        windSpeed: d.vent_max,
                        windDirection: "Inconnue", // Pas stocké dans l'export prévision journalière
                        uvIndex: 0, // Idem
                        condition: getMeteoCondition(d.code_meteo)
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
    }, [communeId, dbForecasts]);

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
                    {isForecastsLoading ? (
                        <Skeleton className="h-32 w-full" />
                    ) : dbForecasts && dbForecasts.length > 0 ? (
                        dbForecasts.map((f, index) => (
                            <DayForecastCard key={f.id} forecast={f} index={index} liveData={index === 0 ? liveData : undefined} />
                        ))
                    ) : (
                        <p className="text-center text-xs text-muted-foreground py-10 italic">Aucune donnée de prévision disponible.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function DayForecastCard({ forecast, index, liveData }: { forecast: MeteoForecast, index: number, liveData?: MeteoLive }) {
    const isToday = index === 0;
    const condition = getMeteoCondition(forecast.code_meteo);
    
    // Fusion avec le live pour aujourd'hui
    const currentTemp = isToday && liveData ? liveData.temperature : null;
    const currentVent = isToday && liveData ? liveData.vent : forecast.vent_max;
    const currentUV = isToday && liveData ? liveData.uv : null;

    return (
        <Card className={cn("overflow-hidden border-2 shadow-sm", isToday && "border-primary/50 ring-1 ring-primary/20 bg-primary/5")}>
            <CardContent className="p-0">
                <div className="bg-muted/30 px-4 py-2 flex justify-between items-center border-b">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">
                            {format(new Date(forecast.date.replace(/-/g, '/')), 'EEEE', { locale: fr })}
                        </span>
                        <span className="font-black text-base">
                            {format(new Date(forecast.date.replace(/-/g, '/')), 'd MMMM', { locale: fr })}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {isToday && liveData && (
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[9px] font-black">
                                EN DIRECT
                            </Badge>
                        )}
                        <WeatherIcon condition={condition} />
                    </div>
                </div>

                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Thermometer className="size-3 text-orange-500" /> Températures
                        </p>
                        <p className="font-black text-sm">
                            {currentTemp || forecast.temp_min}° / {forecast.temp_max}°C
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Wind className="size-3 text-blue-500" /> Vent Max
                        </p>
                        <div className="flex flex-col">
                            <p className="font-black text-sm">{currentVent} ND</p>
                            {forecast.rafales_max > 0 && (
                                <p className="text-[9px] font-bold text-orange-600 italic">Rafales {forecast.rafales_max} ND</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Sun className="size-3 text-yellow-500" /> {isToday ? 'Indice UV' : 'Pluie'}
                        </p>
                        {isToday ? (
                            <Badge className={cn("font-black h-6 px-3 text-xs text-white border-none shadow-sm", (currentUV || 0) > 8 ? "bg-red-500" : (currentUV || 0) > 5 ? "bg-orange-500" : "bg-green-500")}>
                                {currentUV || 'N/A'}
                            </Badge>
                        ) : (
                            <div className="flex items-center gap-1 font-black text-sm text-blue-600">
                                <Droplets className="size-3" /> {forecast.prob_pluie}%
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Info className="size-3 text-slate-500" /> État
                        </p>
                        <span className="text-[10px] font-bold">{condition}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
