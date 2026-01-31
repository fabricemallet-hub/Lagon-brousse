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
  const [selectedIndex, setSelectedIndex] = useState(2); // Start with a forecast a few hours ahead
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // When date changes from context, we might want to reset the view.
  // The current implementation uses index 2. This might be out of bounds if weather.hourly is short.
  useEffect(() => {
    if (selectedIndex >= weather.hourly.length) {
      setSelectedIndex(Math.max(0, weather.hourly.length - 1));
    }
  }, [weather.hourly, selectedIndex]);

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
        <div className="flex flex-col">
          {weather.hourly.slice(0, 24).map((forecast, index) => (
            <div
              key={index}
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
          ))}
        </div>
      </div>
    </div>
  );
}
