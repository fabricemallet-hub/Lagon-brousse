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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
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
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0); 
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setIsClient(true);
    const timer = setInterval(() => setNow(new Date()), 60 * 1000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    if (!weather.hourly.length || !tides.length) {
      return null;
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

    // --- Wind Logic ---
    const currentHour = now.getHours();
    const currentForecast = weather.hourly.find(f => new Date(f.date).getHours() === currentHour) || weather.hourly[0];
    
    const forecastIn3Hours = weather.hourly.find(f => new Date(f.date).getHours() === (currentHour + 3) % 24);
    const forecastIn6Hours = weather.hourly.find(f => new Date(f.date).getHours() === (currentHour + 6) % 24);
    
    let windTrend = "stable";
    if (forecastIn3Hours && forecastIn6Hours) {
        const currentSpeed = currentForecast.windSpeed;
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
    const windSentence = `Vent de ${currentForecast.windSpeed} nœuds, tendance ${windTrend}.`;

    return {tideSentence, windSentence};
  }, [now, weather, tides]);

  useEffect(() => {
    if (!api || !weather.hourly.length) {
      return;
    }

    const onSelect = () => {
      if (api) {
        setSelectedIndex(api.selectedScrollSnap());
      }
    };
    api.on('select', onSelect);
    api.on('reInit', onSelect);

    const currentHour = new Date().getHours();
    
    let closestHourIndex = weather.hourly.findIndex(
      (forecast) => new Date(forecast.date).getHours() === currentHour
    );

    if (closestHourIndex === -1) {
      closestHourIndex = 0; 
    }
    
    api.scrollTo(closestHourIndex, true);
    setSelectedIndex(closestHourIndex);

    return () => {
      if (api) {
        api.off('select', onSelect);
      }
    };
  }, [api, weather]);


  const selectedForecast = weather.hourly[selectedIndex];

  if (!isClient || !selectedForecast) {
    return <Skeleton className="h-[420px] w-full rounded-lg" />;
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        
        <div className="text-center mb-4 border-b border-white/20 pb-3">
          {summary ? (
            <>
              <p className="text-sm font-medium leading-snug">{summary.tideSentence}</p>
              <p className="text-sm text-white/90 leading-snug mt-1">{summary.windSentence}</p>
            </>
          ) : (
            <Skeleton className="h-10 w-full max-w-sm mx-auto bg-white/20" />
          )}
        </div>

        <div className="text-center mb-4">
          <h3 className="font-semibold text-base sm:text-lg capitalize truncate">
            {format(new Date(selectedForecast.date), "eeee dd MMMM 'à' HH'h'", {
              locale: fr,
            })}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
           <div className="flex flex-col items-center justify-center text-center">
                <WeatherConditionIcon
                condition={selectedForecast.condition}
                isNight={selectedForecast.isNight}
                className="size-12"
                />
                <p className="font-medium text-lg mt-2">
                {selectedForecast.condition}
                </p>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-baseline gap-1">
                    <p className="font-bold text-6xl">{selectedForecast.windSpeed}</p>
                    <p className="font-medium text-lg">nœuds</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <WindArrowIcon direction={selectedForecast.windDirection} className="size-5" />
                    <p className="text-base text-white/80">Vent de {selectedForecast.windDirection}</p>
                </div>
                <div className="flex items-center gap-2 text-base text-white/90 mt-2">
                    <Thermometer className="size-5" />
                    <span>{selectedForecast.temp}°C</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2 justify-center">
            <Thermometer className="size-5" />
            <p>
              min/max : {weather.tempMin}° / {weather.tempMax}°
            </p>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Sun className="size-5" />
            <p>Indice UV : {weather.uvIndex}</p>
          </div>
        </div>
      </div>

      <div className="p-2 sm:p-4">
        <Carousel setApi={setApi} opts={{ align: 'start' }}>
          <CarouselContent className="-ml-2">
            {weather.hourly.slice(0, 24).map((forecast, index) => (
              <CarouselItem
                key={index}
                className="basis-1/4 sm:basis-1/5 md:basis-1/6 lg:basis-[12.5%] pl-2"
                onClick={() => api?.scrollTo(index)}
              >
                <div
                  className={cn(
                    'flex flex-col items-center justify-between p-1.5 cursor-pointer rounded-lg border h-full space-y-1 text-center',
                    selectedIndex === index
                      ? 'bg-blue-100 border-blue-200 dark:bg-blue-900/50 dark:border-blue-700'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  <p className="font-bold text-sm">
                    {format(new Date(forecast.date), "HH'h'", { locale: fr })}
                  </p>
                  <WeatherConditionIcon
                    condition={forecast.condition}
                    isNight={forecast.isNight}
                    className="size-7 my-0.5"
                  />
                  
                  <div className="flex flex-col items-center">
                    <p className="font-bold text-lg">{forecast.windSpeed}</p>
                    <p className="text-[10px] text-muted-foreground -mt-1">nœuds</p>
                  </div>
                  
                  <div className="border-t w-full my-0.5"></div>

                  <div className="w-full space-y-0.5 text-[10px]">
                    <div className="flex items-center justify-center gap-1" title="Hauteur de la marée">
                        <Waves className="size-3 text-muted-foreground" />
                        <span className="font-semibold">{forecast.tideHeight.toFixed(1)}m</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 h-5" title="Force du courant">
                        <Zap className="size-3 text-muted-foreground" />
                        {forecast.tidePeakType ? (
                            <Badge variant={forecast.tidePeakType === 'haute' ? 'default' : 'destructive'} className="h-4 px-1 text-[9px] font-semibold leading-none">
                                {forecast.tidePeakType === 'haute' ? 'Pleine' : 'Basse'}
                            </Badge>
                        ) : forecast.tideCurrent === 'Nul' ? (
                            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-semibold leading-none">Étale</Badge>
                        ) : (
                            <span className="font-semibold">{forecast.tideCurrent}</span>
                        )}
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </div>
    </div>
  );
}
