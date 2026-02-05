'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate, LocationData } from '@/lib/data';
import {
  Waves,
  Wind,
  Sunrise,
  Sunset,
  Moon,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { cn, translateWindDirection } from '@/lib/utils';
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { WindMap } from '@/components/ui/wind-map';

function LagonSkeleton() {
  return (
     <div className="space-y-6 w-full px-1">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function LagonPage() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const [data, setData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTime, setSelectedTime] = useState('09:00');

  useEffect(() => {
    setIsLoading(true);
    const fetchedData = getDataForDate(selectedLocation, selectedDate);
    setData(fetchedData);
    setIsLoading(false);
  }, [selectedLocation, selectedDate]);
  
  const sortedTides = useMemo(() => {
    if (!data) return [];
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    return [...data.tides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [data]);

  const selectedSwell = useMemo(() => {
    if (!data?.weather?.swell || data.weather.swell.length === 0) return null;
    return data.weather.swell.find(s => s.time === selectedTime) || data.weather.swell[1];
  }, [data, selectedTime]);

  if (isLoading || !data) {
    return <LagonSkeleton />;
  }

  const { weather, tideStation } = data;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden px-1 pb-12">
      <Card className="w-full shadow-none border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xl font-black uppercase tracking-tighter">Météo & Marées</CardTitle>
          <CardDescription className="text-xs">Prévisions maritimes pour {selectedLocation}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-6">
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-2">
              <Wind className="size-4" /> Prévisions de Vent
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {weather.wind.map((forecast, index) => (
                <div 
                  key={index} 
                  onClick={() => setSelectedTime(forecast.time)}
                  className={cn(
                      "flex justify-between items-center py-3 px-4 border rounded-lg transition-all cursor-pointer min-h-[100px]",
                      selectedTime === forecast.time ? "bg-primary text-primary-foreground border-primary scale-[1.02] shadow-md" : "bg-card hover:bg-muted/50"
                  )}
                >
                    <div className="flex flex-col">
                        <p className="font-black text-base leading-none">{forecast.time}</p>
                        <p className={cn("text-[9px] font-bold uppercase mt-1", selectedTime === forecast.time ? "text-white/80" : "text-muted-foreground")}>{forecast.stability}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-baseline gap-1.5 leading-none">
                                <span className={cn("text-[8px] font-black uppercase", selectedTime === forecast.time ? "text-white/60" : "text-muted-foreground")}>Terre</span>
                                <p className="font-black text-xs">{forecast.speedLand}<span className="text-[8px] ml-0.5">nds</span></p>
                            </div>
                            <div className={cn("flex items-baseline gap-1.5 leading-none border-y py-1 border-current/10")}>
                                <span className={cn("text-[8px] font-black uppercase", selectedTime === forecast.time ? "text-white/60" : "text-muted-foreground")}>Lagon</span>
                                <p className="font-black text-sm">{forecast.speedLagon}<span className="text-[8px] ml-0.5">nds</span></p>
                            </div>
                            <div className="flex items-baseline gap-1.5 leading-none">
                                <span className={cn("text-[8px] font-black uppercase", selectedTime === forecast.time ? "text-white/60" : "text-muted-foreground")}>Large</span>
                                <p className="font-black text-xs">{forecast.speedLarge}<span className="text-[8px] ml-0.5">nds</span></p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center border-l pl-3 border-current/10 min-w-[70px] gap-1">
                            <WindMap direction={forecast.direction} className="size-10" />
                            <p className={cn("text-[9px] font-bold uppercase leading-none", selectedTime === forecast.time ? "text-white/80" : "text-muted-foreground")}>{translateWindDirection(forecast.direction)}</p>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-muted/20">
            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-4">
              <Waves className="size-4" /> Houle à {selectedTime}
            </h3>
            {selectedSwell ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Lagon</p>
                  <p className="font-black text-2xl text-primary">{selectedSwell.inside}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Récif</p>
                  <p className="font-black text-2xl text-accent">{selectedSwell.outside}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground italic">Période : {selectedSwell.period} secondes</p>
                </div>
              </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground italic text-xs">
                    <Waves className="size-8 opacity-20 mb-2" />
                    Données de houle...
                </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
              <div className="flex items-center gap-3 bg-muted/10 p-2 rounded">
                  <Sunrise className="size-5 text-orange-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-60">Lever Soleil</span>
                    <span className="text-xs font-black">{weather.sun.sunrise}</span>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-muted/10 p-2 rounded">
                  <Sunset className="size-5 text-orange-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-60">Coucher Soleil</span>
                    <span className="text-xs font-black">{weather.sun.sunset}</span>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-muted/10 p-2 rounded">
                  <Moon className="size-5 text-blue-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-60">Lever Lune</span>
                    <span className="text-xs font-black">{weather.moon.moonrise}</span>
                  </div>
              </div>
              <div className="flex items-center gap-3 bg-muted/10 p-2 rounded">
                  <Moon className="size-5 text-slate-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-60">Coucher Lune</span>
                    <span className="text-xs font-black">{weather.moon.moonset}</span>
                  </div>
              </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full shadow-none border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <Waves className="size-5 text-primary" /> Marées
          </CardTitle>
          <CardDescription className="text-xs">Station de {tideStation}</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            {sortedTides.map((tide, i) => {
              const TideIcon = tide.type === 'haute' ? TrendingUp : TrendingDown;
              return (
                  <div key={i} className={cn(
                      "flex items-center justify-between p-4 rounded-lg border h-16",
                      tide.type === 'haute' ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5",
                  )}>
                      <div className="flex items-center gap-4">
                          <TideIcon className={cn("size-6", tide.type === 'haute' ? 'text-primary' : 'text-destructive')} />
                          <div className="flex flex-col">
                              <p className={cn("font-black text-xs uppercase", tide.type === 'haute' ? 'text-primary' : 'text-destructive')}>
                                {tide.type === 'haute' ? 'Pleine Mer' : 'Basse Mer'}
                              </p>
                              <p className="font-black text-base">{tide.time}</p>
                          </div>
                      </div>
                      <div className={cn("font-black text-xl", tide.type === 'haute' ? 'text-primary' : 'text-destructive')}>
                          {tide.height.toFixed(2)}m
                      </div>
                  </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
