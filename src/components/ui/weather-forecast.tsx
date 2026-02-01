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

const WindArrowIcon = ({ direction }: { direction: WindDirection }) => {
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
      className="size-5 text-yellow-400"
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
    if (!api) {
      return;
    }
    
    // Set initial state and scroll to noon
    const noonIndex = weather.hourly.findIndex((forecast) => new Date(forecast.date).getHours() === 12);
    const targetIndex = noonIndex !== -1 ? noonIndex : 0;
    setSelectedIndex(targetIndex);
    api.scrollTo(targetIndex, true);

    // Set up listener for subsequent selections
    const onSelect = () => {
      setSelectedIndex(api.selectedScrollSnap());
    };
    api.on('select', onSelect);
    
    // Clean up listener
    return () => {
      api.off('select', onSelect);
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
            <p className="font-bold text-5xl">{selectedForecast.temp}°</p>
            <div className="flex items-center gap-2 mt-2">
              <WindArrowIcon direction={selectedForecast.windDirection} />
              <p className="font-semibold">
                {selectedForecast.windSpeed} km/h
              </p>
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
                className="basis-1/4 sm:basis-1/5 md:basis-[12.5%]"
                onClick={() => api?.scrollTo(index)}
              >
                <div
                  className={cn(
                    'flex flex-col items-center justify-between p-2 cursor-pointer rounded-lg border h-full space-y-2 text-center',
                    selectedIndex === index
                      ? 'bg-blue-100 border-blue-200'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  <p className="font-bold text-sm">
                    {format(new Date(forecast.date), "HH'h'", { locale: fr })}
                  </p>
                  <WeatherConditionIcon
                    condition={forecast.condition}
                    isNight={forecast.isNight}
                    className="size-6"
                  />
                  <p className="font-semibold text-sm">{forecast.temp}°</p>
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
