'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wind, Thermometer, Sun, MapPin, Search, ChevronLeft, CalendarDays, Waves, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import type { MeteoLive, LocationData } from '@/lib/types';
import { translateWindDirection } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { generateProceduralData } from '@/lib/data';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoonPhaseIcon } from '@/components/ui/lunar-calendar';
import { cn } from '@/lib/utils';

export default function MeteoLivePage() {
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(null);
  
  const meteoQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meteo_caledonie');
  }, [firestore]);

  const { data: rawCommunes, isLoading } = useCollection<MeteoLive>(meteoQuery);

  const communes = rawCommunes?.filter(c => 
    c.id.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.id.localeCompare(b.id));

  // Affichage de la vue détaillée si une commune est sélectionnée
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
            Choisissez une commune pour voir les prévisions à 7 jours.
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
              className="overflow-hidden border-2 shadow-sm active:scale-[0.98] transition-transform cursor-pointer hover:border-primary/30"
              onClick={() => setSelectedCommuneId(commune.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="size-6 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-black uppercase tracking-tighter text-sm leading-none">{commune.id}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-[10px] font-black text-blue-600 dark:text-blue-400">
                        <Wind className="size-3" /> {commune.vent} ND {commune.direction && `(${translateWindDirection(commune.direction)})`}
                      </div>
                      <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded text-[10px] font-black text-orange-600 dark:text-orange-400">
                        <Thermometer className="size-3" /> {commune.temperature}°C
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Indice UV</span>
                  <Badge className="font-black h-7 px-3 text-xs bg-accent text-white border-none shadow-md">
                    {commune.uv}
                  </Badge>
                </div>
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

            {liveData && (
                <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
                    <div className="absolute right-0 top-0 opacity-10 -translate-y-4 translate-x-4">
                        <Sun className="size-48" />
                    </div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <Badge className="bg-white/20 text-white border-none font-black text-[10px] uppercase tracking-widest">En Direct</Badge>
                            <span className="text-[10px] font-bold opacity-80">{format(new Date(), 'HH:mm', { locale: fr })}</span>
                        </div>
                        <CardTitle className="text-4xl font-black mt-2">{liveData.temperature}°C</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
                                <Wind className="size-5" />
                                <div>
                                    <p className="text-[10px] font-black uppercase opacity-70">Vent</p>
                                    <p className="font-black text-sm">{liveData.vent} ND {liveData.direction && `(${translateWindDirection(liveData.direction)})`}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
                                <Sun className="size-5" />
                                <div>
                                    <p className="text-[10px] font-black uppercase opacity-70">Indice UV</p>
                                    <p className="font-black text-sm">{liveData.uv}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                    <CalendarDays className="size-4" /> Prévisions 7 jours
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
    const { weather, tides, farming } = data;
    
    const sortedTides = [...tides].sort((a, b) => {
        const t1 = a.time.split(':').map(Number);
        const t2 = b.time.split(':').map(Number);
        return (t1[0] * 60 + t1[1]) - (t2[0] * 60 + t2[1]);
    });

    const tempMin = today && liveData ? Math.min(liveData.temperature, weather.tempMin) : weather.tempMin;
    const tempMax = today && liveData ? Math.max(liveData.temperature, weather.tempMax) : weather.tempMax;

    return (
        <Card className={cn("overflow-hidden border-2 shadow-sm", today && "border-primary/50 ring-1 ring-primary/20 bg-primary/5")}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">{format(date, 'EEEE', { locale: fr })}</span>
                        <span className="font-black text-lg leading-none">{format(date, 'd MMMM', { locale: fr })}</span>
                    </div>
                    {today && <Badge className="bg-primary text-white font-black text-[9px] h-5 uppercase">Aujourd'hui</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Thermometer className="size-5 text-orange-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Température</span>
                            <span className="font-black text-sm">{tempMin}° / {tempMax}°</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Wind className="size-5 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Vent Max</span>
                            <span className="font-black text-sm">
                                {today && liveData ? liveData.vent : Math.max(...weather.wind.map(w => w.speed))} ND
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                            <Sun className="size-5 text-yellow-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Indice UV</span>
                            <span className="font-black text-sm">{today && liveData ? liveData.uv : weather.uvIndex}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0">
                            <MoonPhaseIcon phase={weather.moon.phase} className="size-5 text-slate-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Lune</span>
                            <span className="text-[10px] font-bold truncate max-w-[80px]">{weather.moon.phase}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-dashed">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Waves className="size-3" /> Marées du jour
                        </h4>
                        <span className="text-[9px] font-bold text-muted-foreground italic">Station : {data.tideStation}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {sortedTides.map((tide, i) => {
                            const IsHigh = tide.type === 'haute';
                            return (
                                <div key={i} className={cn(
                                    "flex flex-col items-center p-2 rounded-lg border",
                                    IsHigh ? "bg-primary/5 border-primary/10" : "bg-destructive/5 border-destructive/10"
                                )}>
                                    <span className={cn("text-[8px] font-black uppercase mb-1", IsHigh ? "text-primary" : "text-destructive")}>{tide.type}</span>
                                    <span className="font-black text-xs leading-none">{tide.time}</span>
                                    <span className="text-[10px] font-bold mt-1 opacity-60">{tide.height.toFixed(2)}m</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 p-3 bg-accent/5 border border-accent/10 rounded-xl flex gap-3 items-start">
                    <div className="p-1.5 rounded-lg bg-accent/10 shrink-0">
                        <Info className="size-3 text-accent" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-accent">Conseil Terroir</span>
                        <p className="text-[11px] font-medium leading-tight">{farming.recommendation}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}