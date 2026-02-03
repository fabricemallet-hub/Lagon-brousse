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

export function WeatherForecast({ weather, tides }: { weather: WeatherData; tides: Tide[] }) {
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const { summary, selectedForecast, hourlyForecastsToShow, isSelectedDayToday } = useMemo(() => {
    if (!weather.hourly.length || !tides.length) {
      return { summary: null, selectedForecast: null, hourlyForecastsToShow: [], isSelectedDayToday: false };
    }

    const timeToDate = (timeStr: string, date: Date) => {
      const newDate = new Date(date);
      const [h, m] = timeStr.split(':').map(Number);
      newDate.setHours(h, m, 0, 0);
      return newDate;
    };

    const tideEventsToday = tides.map(tide => ({
      ...tide,
      date: timeToDate(tide.time, now),
    }));
    
    const firstTideOfList = tides[0];
    const firstTideEventTomorrow = {
        ...firstTideOfList,
        date: timeToDate(firstTideOfList.time, new Date(now.getTime() + 24 * 60 * 60 * 1000))
    };

    const allTideEvents = [...tideEventsToday, firstTideEventTomorrow].sort((a,b) => a.date.getTime() - b.date.getTime());
    
    let nextTide = allTideEvents.find(tide => tide.date > now);
    if (!nextTide) nextTide = firstTideEventTomorrow;
    
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
        const upperThreshold = currentSpeed * 1.2;
        const lowerThreshold = currentSpeed * 0.8;
        if (speed3h < lowerThreshold) windTrend = "à la baisse";
        else if (speed3h > upperThreshold) windTrend = "à la hausse";
    }
    const windSentence = `Vent de ${_selectedForecast.windSpeed} nœuds de ${translateWindDirection(_selectedForecast.windDirection)}, tendance ${windTrend}.`;

    // Strict 00h à 23h pour la journée sélectionnée
    const sortedForecasts = [...weather.hourly].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const isToday = new Date(sortedForecasts[0].date).toDateString() === now.toDateString();

    return { 
      summary: {tideSentence, windSentence}, 
      selectedForecast: _selectedForecast, 
      hourlyForecastsToShow: sortedForecasts,
      isSelectedDayToday: isToday
    };
  }, [now, weather, tides]);

  // Auto-scroll vers l'heure actuelle
  useEffect(() => {
    if (isClient && isSelectedDayToday && scrollRef.current) {
        const currentHour = now.getHours();
        const element = scrollRef.current.querySelector(`[data-hour="${currentHour}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [isClient, isSelectedDayToday, now]);

  if (!isClient || !selectedForecast) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden rounded-lg border bg-card shadow-sm">
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <div className="text-center mb-3 border-b border-white/20 pb-3">
          {summary ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1 opacity-80">Résumé du moment</p>
              <p className="text-xs font-medium leading-relaxed">{summary.tideSentence}</p>
              <p className="text-xs text-white/90 leading-relaxed mt-1">{summary.windSentence}</p>
            </>
          ) : (
            <Skeleton className="h-10 w-full bg-white/20" />
          )}
        </div>

        <div className="flex justify-around items-center gap-4 py-2">
           <div className="flex flex-col items-center text-center">
                <WeatherConditionIcon condition={selectedForecast.condition} isNight={selectedForecast.isNight} className="size-10 mb-1" />
                <p className="font-bold text-xs">{selectedForecast.condition}</p>
            </div>
            <div className="flex flex-col items-center text-center">
                <div className="flex items-baseline gap-1">
                    <p className="font-black text-5xl">{selectedForecast.windSpeed}</p>
                    <p className="font-bold text-sm">nds</p>
                </div>
                <div className="flex items-center gap-1 mt-1">
                    <WindArrowIcon direction={selectedForecast.windDirection} className="size-4" />
                    <p className="text-[10px] font-bold uppercase">Vent de {translateWindDirection(selectedForecast.windDirection)}</p>
                </div>
            </div>
             <div className="flex flex-col items-center gap-2 text-xs font-bold">
                <div className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded">
                    <Thermometer className="size-4" />
                    <span>{selectedForecast.temp}°C</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded">
                    <Sun className="size-4" />
                    <span>UV: {selectedForecast.uvIndex}</span>
                </div>
             </div>
        </div>
      </div>

      <div className="p-2 w-full">
        <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 scrollbar-hide px-1" ref={scrollRef}>
          {hourlyForecastsToShow.map((forecast, index) => {
             const forecastDate = new Date(forecast.date);
             const forecastHour = forecastDate.getHours();
             const isPast = isSelectedDayToday && forecastHour < now.getHours();
             const isCurrent = isSelectedDayToday && forecastHour === now.getHours();
             
             return (
              <div 
                key={index} 
                data-hour={forecastHour}
                className={cn(
                  'flex-shrink-0 w-20 flex flex-col items-center justify-between p-2 rounded-lg border h-full space-y-1 text-center bg-card transition-all',
                   isCurrent && 'bg-blue-50 border-blue-400 ring-1 ring-blue-400 scale-[1.02] z-10',
                   isPast && 'opacity-40 grayscale bg-muted/10'
                )}
              >
                <p className={cn(
                  "font-black text-[10px] uppercase",
                  isPast ? "text-muted-foreground/60" : "text-muted-foreground"
                )}>
                  {format(forecastDate, "HH'h'", { locale: fr })}
                </p>
                <WeatherConditionIcon 
                  condition={forecast.condition} 
                  isNight={forecast.isNight} 
                  className={cn("size-6 my-1", isPast && "opacity-50")} 
                />
                
                <div className="flex items-baseline gap-0.5">
                  <p className={cn("font-black text-xs", isPast && "text-muted-foreground")}>{forecast.windSpeed}</p>
                  <p className="text-[8px] font-bold uppercase opacity-60">nds</p>
                </div>
                
                <div className="border-t w-full my-1 opacity-20"></div>

                <div className="w-full space-y-1">
                  <div className={cn("flex items-center justify-center", isPast ? "text-muted-foreground/60" : "text-primary")}>
                    <Waves className="size-3 mr-1" />
                    <span className="font-black text-[10px]">{forecast.tideHeight.toFixed(1)}m</span>
                  </div>
                  <div className={cn("flex items-center justify-center h-4", isPast ? "text-muted-foreground/60" : "text-accent")}>
                      <Zap className="size-3 mr-1" />
                      <span className="font-black text-[8px] uppercase">
                          {forecast.tidePeakType ? (forecast.tidePeakType === 'haute' ? 'Mer' : 'Basse') : 
                           forecast.tideCurrent === 'Nul' ? 'Ét' : forecast.tideCurrent.substring(0, 3)}
                      </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-3 border-t bg-muted/30 flex justify-center items-center gap-8 text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
        <div className="flex items-center gap-1.5"><Waves className="size-3" /><span>Hauteur</span></div>
        <div className="flex items-center gap-1.5"><Zap className="size-3" /><span>Courant</span></div>
      </div>
    </div>
  );
}
