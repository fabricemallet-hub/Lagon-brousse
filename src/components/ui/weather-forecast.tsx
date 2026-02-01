'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudMoon,
  CloudSun,
  Sun,
  Thermometer,
  Cloud,
  CloudRain,
  ArrowRight,
  Moon,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { WeatherData, HourlyForecast, WindDirection } from '@/lib/types';
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

export function WeatherForecast({ weather }: { weather: WeatherData }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

    // On page load, find the forecast closest to the current time.
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find the index of the forecast for the current hour.
    let closestHourIndex = weather.hourly.findIndex(
      (forecast) => new Date(forecast.date).getHours() === currentHour
    );

    // If no exact hour found (e.g. API data starts later or it's not available), default to the first entry.
    if (closestHourIndex === -1) {
      closestHourIndex = 0;
    }

    const selectIndex = closestHourIndex;
    
    // Set the initial scroll position to be just before the selected time for context, allowing two items to be visible.
    const scrollToIndex = Math.max(0, selectIndex > 0 ? selectIndex - 1 : 0);

    api.scrollTo(scrollToIndex, true);
    setSelectedIndex(selectIndex);

    return () => {
      if (api) {
        api.off('select', onSelect);
        api.off('reInit', onSelect);
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
              className="size-16"
            />
            <p className="font-medium text-base mt-2">
              {selectedForecast.condition}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <p className="font-bold text-6xl">{selectedForecast.temp}°</p>
             <div className="flex items-center gap-3 mt-2">
              <WindArrowIcon direction={selectedForecast.windDirection} className="size-7" />
              <div className="text-left">
                <p className="font-bold text-xl">{selectedForecast.windSpeed} nœuds</p>
                <p className="text-base text-white/80">Vent de {selectedForecast.windDirection}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <Thermometer className="size-5" />
            <p>
              min/max : {weather.tempMin}° / {weather.tempMax}°
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sun className="size-5" />
            <p>Indice UV : {weather.uvIndex}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <Carousel setApi={setApi} opts={{ align: 'start' }}>
          <CarouselContent>
            {weather.hourly.slice(0, 24).map((forecast, index) => (
              <CarouselItem
                key={index}
                className="basis-1/2 sm:basis-1/3"
                onClick={() => api?.scrollTo(index)}
              >
                <div
                  className={cn(
                    'flex flex-col items-center justify-between p-3 cursor-pointer rounded-lg border h-full space-y-2 text-center',
                    selectedIndex === index
                      ? 'bg-blue-100 border-blue-200'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  <p className="font-bold text-lg">
                    {format(new Date(forecast.date), "HH'h'", { locale: fr })}
                  </p>
                  <WeatherConditionIcon
                    condition={forecast.condition}
                    isNight={forecast.isNight}
                    className="size-10"
                  />
                  <p className="font-bold text-2xl">{forecast.temp}°</p>
                  <div className="flex flex-col items-center text-muted-foreground">
                    <WindArrowIcon direction={forecast.windDirection} className="size-6" />
                    <span className="font-semibold text-base">{forecast.windSpeed}</span>
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
