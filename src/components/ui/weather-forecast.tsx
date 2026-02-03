'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { Badge } from './badge';

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

  useEffect(() => {
    setIsClient(true);
    const timer = setInterval(() => setNow(new Date()), 60 * 1000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const { summary, selectedForecast, hourlyForecastsToShow } = useMemo(() => {
    if (!weather.hourly.length || !tides.length) {
      return { summary: null, selectedForecast: null, hourlyForecastsToShow: [] };
    }

    // --- Tide Logic ---
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
    if (!nextTide) {
        nextTide = firstTideEventTomorrow;
    }
    
    const tideDirection = nextTide.type === 'haute' ? 'montante' : 'descendante';
    const remainingTime = formatDistanceToNow(nextTide.date, { locale: fr, addSuffix: true });
    const tideSentence = `Marée ${tideDirection} jusqu'à ${nextTide.time}, pleine ${nextTide.type === 'haute' ? 'mer' : 'basse'} ${remainingTime}.`;

    // --- Wind & Selected Forecast Logic ---
    const currentHour = now.getHours();
    const _selectedForecast = weather.hourly.find(f => new Date(f.date).getHours() === currentHour) || weather.hourly[0];
    
    const forecastIn3Hours = weather.hourly.find(f => new Date(f.date).getHours() === (currentHour + 3) % 24);
    const forecastIn6Hours = weather.hourly.find(f => new Date(f.date).getHours() === (currentHour + 6) % 24);
    
    let windTrend = "stable";
    if (forecastIn3Hours && forecastIn6Hours) {
        const currentSpeed = _selectedForecast.windSpeed;
        const speed3h = forecastIn3Hours.windSpeed;
        const speed6h = forecastIn6Hours.windSpeed;
        const upperThreshold = currentSpeed * 1.2;
        const lowerThreshold = currentSpeed * 0.8;

        if (speed3h < lowerThreshold && speed6h > speed3h) {
            windTrend = "à la baisse puis remontant";
        } else if (speed3h < lowerThreshold) {
            windTrend = "à la baisse";
        } else if (speed3h > upperThreshold && speed6h < speed3h) {
            windTrend = "à la hausse puis baissant";
        } else if (speed3h > upperThreshold) {
            windTrend = "à la hausse";
        }
    }
    const windSentence = `Vent de ${_selectedForecast.windSpeed} nœuds, tendance ${windTrend}.`;

    const forecasts = weather.hourly.slice(0, 24);
    
    // Check if the forecast is for today
    const forecastDate = new Date(forecasts[0].date);
    const isToday = forecastDate.getFullYear() === now.getFullYear() &&
                    forecastDate.getMonth() === now.getMonth() &&
                    forecastDate.getDate() === now.getDate();

    // Filter out past hours only if it's today
    const forecastsToShow = isToday
      ? forecasts.filter(f => new Date(f.date).getHours() >= currentHour)
      : forecasts;

    return { summary: {tideSentence, windSentence}, selectedForecast: _selectedForecast, hourlyForecastsToShow: forecastsToShow };
  }, [now, weather, tides]);

  if (!isClient || !selectedForecast) {
    return <Skeleton className="h-[420px] w-full rounded-lg" />;
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white p-2 sm:p-4 rounded-t-lg">
        
        <div className="text-center mb-2 border-b border-white/20 pb-2">
          {summary ? (
            <>
              <p className="text-[11px] sm:text-sm font-medium leading-snug">{summary.tideSentence}</p>
              <p className="text-[11px] sm:text-sm text-white/90 leading-snug mt-1">{summary.windSentence}</p>
            </>
          ) : (
            <Skeleton className="h-10 w-full max-w-sm mx-auto bg-white/20" />
          )}
        </div>

        <div className="text-center">
          <h3 className="font-semibold text-sm sm:text-base capitalize truncate">
            {format(new Date(selectedForecast.date), "eeee dd MMMM", {
              locale: fr,
            })}
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-around mt-2">
           <div className="flex flex-col items-center justify-center text-center">
                <WeatherConditionIcon
                condition={selectedForecast.condition}
                isNight={selectedForecast.isNight}
                className="size-8 sm:size-10"
                />
                <p className="font-medium text-sm sm:text-base mt-1">
                {selectedForecast.condition}
                </p>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-baseline gap-1">
                    <p className="font-bold text-4xl sm:text-5xl">{selectedForecast.windSpeed}</p>
                    <p className="font-medium text-sm sm:text-base">nœuds</p>
                </div>
                <div className="flex items-center gap-2">
                    <WindArrowIcon direction={selectedForecast.windDirection} className="size-3 sm:size-4" />
                    <p className="text-xs sm:text-sm text-white/80">Vent de {selectedForecast.windDirection}</p>
                </div>
            </div>
             <div className="flex flex-col items-center justify-center text-center text-xs sm:text-sm space-y-1 text-white/90">
                <div className="flex items-center gap-2">
                    <Thermometer className="size-3 sm:size-4" />
                    <span>{selectedForecast.temp}°C</span>
                </div>
                <div className="flex items-center gap-2">
                    <Sun className="size-3 sm:size-4" />
                    <span>Indice UV: {weather.uvIndex}</span>
                </div>
             </div>
        </div>
      </div>

      <div className="p-2">
        <div className="flex flex-row flex-wrap -m-1">
          {hourlyForecastsToShow.map((forecast, index) => {
             const isSelected = new Date(forecast.date).getHours() === new Date(selectedForecast.date).getHours();
             return (
              <div key={index} className="basis-[24%] p-1">
                <div
                  className={cn(
                    'flex flex-col items-center justify-between p-1 rounded-lg border h-full space-y-1 text-center bg-card',
                     isSelected && 'bg-blue-100 border-blue-200 dark:bg-blue-900/50 dark:border-blue-700'
                  )}
                >
                  <p className="font-bold text-xs">
                    {format(new Date(forecast.date), "HH'h'", { locale: fr })}
                  </p>
                  <WeatherConditionIcon
                    condition={forecast.condition}
                    isNight={forecast.isNight}
                    className="size-4 sm:size-5 my-0.5"
                  />
                  
                  <div className="flex items-baseline gap-0.5">
                    <p className="font-bold text-[11px] sm:text-xs">{forecast.windSpeed}</p>
                    <p className="text-[9px] text-muted-foreground">nœuds</p>
                  </div>
                  
                  <div className="border-t w-full my-0.5"></div>

                  <div className="w-full space-y-0.5 text-[10px]">
                    <div className="flex items-center justify-center">
                      <Waves className="size-3 text-muted-foreground mr-1" />
                      <span className="font-semibold">{forecast.tideHeight.toFixed(1)}m</span>
                    </div>
                    <div className="flex items-center justify-center h-5">
                        <Zap className="size-3 text-muted-foreground mr-1" />
                        <span className="font-semibold text-[10px]">
                            {forecast.tidePeakType ? (forecast.tidePeakType === 'haute' ? 'Pleine' : 'Basse') : 
                             forecast.tideCurrent === 'Nul' ? 'Étale' : 
                             forecast.tideCurrent}
                        </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Légende explicative */}
      <div className="p-2 border-t bg-muted/20 flex justify-center items-center gap-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
        <div className="flex items-center gap-1.5">
          <Waves className="size-3" />
          <span>Hauteur</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="size-3" />
          <span>Courant</span>
        </div>
      </div>
    </div>
  );
}
