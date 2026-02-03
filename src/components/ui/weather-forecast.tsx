'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CloudMoon,
  CloudSun,
  Sun,
  Thermometer,
  Cloud,
  CloudRain,
  ArrowRight,
  Moon,
  Waves,
  Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { WeatherData, HourlyForecast, WindDirection, Tide } from '@/lib/types';
import { cn, translateWindDirection } from '@/lib/utils';
import { Skeleton } from './skeleton';

const WeatherConditionIcon = ({
  condition,
  isNight,
  className,
}: {
  condition: HourlyForecast['condition'];
  isNight: boolean;
  className?: string;
}) => {
  const props = { className: cn('size-8', className) };
  if (isNight) {
    switch (condition) {
      case 'Peu nuageux':
        return <CloudMoon {...props} />;
      case 'Nuit claire':
        return <Moon {...props} />;
      case 'Nuageux':
        return <Cloud {...props} />;
      case 'Averses':
        return <CloudRain {...props} />;
      case 'Pluvieux':
        return <CloudRain {...props} />;
      default:
        return <CloudMoon {...props} />;
    }
  } else {
    switch (condition) {
      case 'Ensoleillé':
        return <Sun {...props} />;
      case 'Peu nuageux':
        return <CloudSun {...props} />;
      case 'Nuageux':
        return <Cloud {...props} />;
      case 'Averses':
        return <CloudRain {...props} />;
      case 'Pluvieux':
        return <CloudRain {...props} />;
      default:
        return <CloudSun {...props} />;
    }
  }
};

const WindArrowIcon = ({ direction, className }: { direction: WindDirection, className?: string }) => {
  const rotation =
    {
      N: 180,
      NE: 225,
      E: 270,
      SE: 315,
      S: 0,
      SW: 45,
      W: 90,
      NW: 135,
    }[direction] || 0;

  return (
    <ArrowRight
      className={cn('size-5 text-yellow-400', className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    />
  );
};

export function WeatherForecast({ 
  weather, 
  tides,
  isToday = false
}: { 
  weather: WeatherData; 
  tides: Tide[];
  isToday?: boolean;
}) {
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const { summary, selectedForecast, hourlyForecastsToShow } = useMemo(() => {
    if (!weather.hourly.length || !tides.length) {
      return { summary: null, selectedForecast: null, hourlyForecastsToShow: [] };
    }

    const timeToDate = (timeStr: string, date: Date) => {
      const newDate = new Date(date);
      const [h, m] = timeStr.split(':').map(Number);
      newDate.setHours(h, m, 0, 0);
      return newDate;
    };

    const currentTideEvents = tides.map(tide => ({
      ...tide,
      date: timeToDate(tide.time, now),
    }));
    
    const sortedTideEvents = [...currentTideEvents].sort((a,b) => a.date.getTime() - b.date.getTime());
    let nextTide = sortedTideEvents.find(tide => tide.date > now);
    
    if (!nextTide) {
        nextTide = { ...sortedTideEvents[0], date: new Date(sortedTideEvents[0].date.getTime() + 24 * 60 * 60 * 1000) };
    }
    
    const tideDirection = nextTide.type === 'haute' ? 'montante' : 'descendante';
    const remainingTime = formatDistanceToNow(nextTide.date, { locale: fr, addSuffix: true });
    const tideSentence = `Marée ${tideDirection} jusqu'à ${nextTide.time}, pleine ${nextTide.type === 'haute' ? 'mer' : 'basse'} ${remainingTime}.`;

    const currentHour = now.getHours();
    const _selectedForecast = weather.hourly.find(f => new Date(f.date).getHours() === currentHour) || weather.hourly[0];
    
    const forecastIn3Hours = weather.hourly.find(f => new Date(f.date).getHours() === (currentHour + 3) % 24);
    
    let windTrend = "stable";
    if (forecastIn3Hours) {
        const currentSpeed = _selectedForecast.windSpeed;
        const speed3h = forecastIn3Hours.windSpeed;
        if (speed3h < currentSpeed * 0.8) windTrend = "à la baisse";
        else if (speed3h > currentSpeed * 1.2) windTrend = "à la hausse";
    }
    const windSentence = `Vent de ${_selectedForecast.windSpeed} nœuds de ${translateWindDirection(_selectedForecast.windDirection)}, tendance ${windTrend}.`;

    // SORT BY HOUR: 00h to 23h
    const sortedForecasts = [...weather.hourly].sort((a, b) => 
      new Date(a.date).getHours() - new Date(b.date).getHours()
    );

    return { 
      summary: {tideSentence, windSentence}, 
      selectedForecast: _selectedForecast, 
      hourlyForecastsToShow: sortedForecasts
    };
  }, [now, weather, tides]);

  useEffect(() => {
    if (isClient && isToday && scrollRef.current) {
        const currentHour = now.getHours();
        const element = scrollRef.current.querySelector(`[data-hour="${currentHour}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [isClient, isToday, now]);

  if (!isClient || !selectedForecast) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden rounded-xl border bg-card shadow-md">
      <div className="bg-blue-600 text-white p-5 rounded-t-xl">
        <div className="text-center mb-4 border-b border-white/20 pb-4">
          {summary ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-70">Aperçu Immédiat</p>
              <p className="text-sm font-bold leading-tight">{summary.tideSentence}</p>
              <p className="text-xs text-blue-100 leading-tight mt-1.5">{summary.windSentence}</p>
            </>
          ) : (
            <Skeleton className="h-12 w-full bg-white/10" />
          )}
        </div>

        <div className="flex justify-around items-center gap-4 py-1">
           <div className="flex flex-col items-center text-center">
                <WeatherConditionIcon condition={selectedForecast.condition} isNight={selectedForecast.isNight} className="size-12 mb-1.5" />
                <p className="font-black text-[10px] uppercase tracking-tighter">{selectedForecast.condition}</p>
            </div>
            <div className="flex flex-col items-center text-center">
                <div className="flex items-baseline gap-1">
                    <p className="font-black text-6xl leading-none">{selectedForecast.windSpeed}</p>
                    <p className="font-black text-sm uppercase">nds</p>
                </div>
                <div className="flex items-center gap-1.5 mt-2 bg-white/10 px-2 py-0.5 rounded-full">
                    <WindArrowIcon direction={selectedForecast.windDirection} className="size-3.5" />
                    <p className="text-[10px] font-black uppercase tracking-tighter">{translateWindDirection(selectedForecast.windDirection)}</p>
                </div>
            </div>
             <div className="flex flex-col items-center gap-2.5">
                <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-lg border border-white/10 shadow-inner">
                    <Thermometer className="size-4 text-orange-300" />
                    <span className="font-black text-sm">{selectedForecast.temp}°C</span>
                </div>
                <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-lg border border-white/10 shadow-inner">
                    <Sun className="size-4 text-yellow-300" />
                    <span className="font-black text-sm text-yellow-50">UV: {selectedForecast.uvIndex}</span>
                </div>
             </div>
        </div>
      </div>

      <div className="p-3 w-full bg-muted/5">
        <div className="flex flex-nowrap overflow-x-auto gap-2.5 pb-3 scrollbar-hide px-1" ref={scrollRef}>
          {hourlyForecastsToShow.map((forecast, index) => {
             const forecastDate = new Date(forecast.date);
             const forecastHour = forecastDate.getHours();
             const currentHour = now.getHours();
             
             const isPast = isToday && forecastHour < currentHour;
             const isCurrent = isToday && forecastHour === currentHour;
             
             return (
              <div 
                key={index} 
                data-hour={forecastHour}
                className={cn(
                  'flex-shrink-0 w-24 flex flex-col items-center justify-between p-3 rounded-xl border h-40 space-y-2 text-center transition-all duration-300',
                   isCurrent ? 'bg-primary text-primary-foreground border-primary scale-[1.05] z-10 shadow-xl' : 'bg-card',
                   isPast && 'bg-slate-200/90 text-muted-foreground/30 border-muted opacity-30 grayscale pointer-events-none'
                )}
              >
                <p className={cn(
                  "font-black text-xs uppercase tracking-tighter",
                  isCurrent ? "text-white" : "text-muted-foreground"
                )}>
                  {format(forecastDate, "HH'h'", { locale: fr })}
                </p>
                
                <WeatherConditionIcon 
                  condition={forecast.condition} 
                  isNight={forecast.isNight} 
                  className={cn("size-8", isCurrent ? "text-white" : "")} 
                />
                
                <div className="flex items-baseline gap-0.5">
                  <p className="font-black text-base">{forecast.windSpeed}</p>
                  <p className="text-[9px] font-black uppercase opacity-60">nds</p>
                </div>
                
                <div className={cn("border-t w-full my-1", isCurrent ? "border-white/30" : "border-border")}></div>

                <div className="w-full space-y-1.5">
                  <div className={cn("flex items-center justify-center", isCurrent ? "text-white" : "text-primary")}>
                    <Waves className="size-3.5 mr-1.5 shrink-0" />
                    <span className="font-black text-xs">{forecast.tideHeight.toFixed(1)}m</span>
                  </div>
                  <div className={cn("flex items-center justify-center", isCurrent ? "text-white/90" : "text-accent")}>
                      <Zap className="size-3.5 mr-1.5 shrink-0" />
                      <span className="font-black text-[9px] uppercase leading-none">
                          {forecast.tidePeakType ? (forecast.tidePeakType === 'haute' ? 'Mer' : 'Basse') : 
                           forecast.tideCurrent === 'Nul' ? 'Étale' : forecast.tideCurrent}
                      </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-4 border-t bg-muted/20 flex justify-center items-center gap-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
        <div className="flex items-center gap-2"><Waves className="size-4 text-primary/50" /><span>Hauteur Eau</span></div>
        <div className="flex items-center gap-2"><Zap className="size-4 text-accent/50" /><span>Courant</span></div>
      </div>
    </div>
  );
}
