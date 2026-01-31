'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // When weather data changes, find the index for 12:00 PM.
    const noonIndex = weather.hourly.findIndex(
      (forecast) => new Date(forecast.date).getHours() === 12
    );

    const targetIndex = noonIndex !== -1 ? noonIndex : 0;
    setSelectedIndex(targetIndex);

    // Scroll to the selected index instantly
    setTimeout(() => {
      if (listRef.current) {
        const itemElement = listRef.current.querySelector(`[data-index="${targetIndex}"]`) as HTMLElement;
        if (itemElement) {
          itemElement.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
          });
        }
      }
    }, 0);
  }, [weather]); // Re-run when weather data (i.e., the selected day) changes.

  const selectedForecast = weather.hourly[selectedIndex];

  if (!isClient || !selectedForecast) {
    return <Skeleton className="h-[380px] w-full rounded-lg" />;
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

      <div className="max-h-[260px] overflow-y-auto">
        <div className="flex flex-col" ref={listRef}>
          {weather.hourly.slice(0, 24).map((forecast, index) => {
            const hour = new Date(forecast.date).getHours();
            if (hour < 11 || hour > 14) {
              return null;
            }
            return (
              <div
                key={index}
                data-index={index}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'flex items-center justify-between p-3 cursor-pointer border-b last:border-b-0',
                  selectedIndex === index
                    ? 'bg-blue-100'
                    : 'bg-card hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <WeatherConditionIcon
                    condition={forecast.condition}
                    isNight={forecast.isNight}
                    className="size-6"
                  />
                  <p className="font-bold w-12">
                    {format(new Date(forecast.date), "HH'h'", { locale: fr })}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <p className="font-semibold w-8 text-center">
                    {forecast.temp}°
                  </p>
                  <div className="flex items-center gap-1 w-20 justify-end">
                    <WindArrowIcon direction={forecast.windDirection} />
                    <p className="text-xs font-semibold">
                      {forecast.windSpeed} km/h
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
