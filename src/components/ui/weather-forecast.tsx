'use client';

import React, { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  CloudMoon,
  CloudSun,
  Sun,
  Thermometer,
  Cloud,
  CloudRain,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Moon,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { WeatherData, HourlyForecast, WindDirection } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './button';

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
  const [api, setApi] = React.useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(2); // Start with current time-ish

  useEffect(() => {
    if (!api) {
      return;
    }
    const onSelect = (api: CarouselApi) => {
      setSelectedIndex(api.selectedScrollSnap());
    };
    api.on('select', onSelect);
    api.scrollTo(selectedIndex, true);
    onSelect(api);

    return () => {
      api.off('select', onSelect);
    };
  }, [api, selectedIndex]);
  
  const selectedForecast = weather.hourly[selectedIndex];
  if (!selectedForecast) {
    return null;
  }

  const handlePrev = () => api?.scrollPrev();
  const handleNext = () => api?.scrollNext();

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 mb-4">
          <Button
            onClick={handlePrev}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            disabled={!api?.canScrollPrev()}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h3 className="font-semibold text-sm sm:text-lg capitalize text-center">
            {format(new Date(selectedForecast.date), "eeee dd MMMM 'à' HH'h'", {
              locale: fr,
            })}
          </h3>
          <Button
            onClick={handleNext}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            disabled={!api?.canScrollNext()}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
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
          <div className="flex flex-col items-center justify-center">
            <WindArrowIcon direction={selectedForecast.windDirection} />
            <p className="font-bold text-lg mt-2">
              {selectedForecast.windSpeed} km/h
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <Thermometer className="size-5" />
            <div>
              <p>Température : {selectedForecast.temp}°</p>
              <p className="text-xs">
                min/max : {weather.tempMin}° / {weather.tempMax}°
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sun className="size-5" />
            <p>Indice UV : {weather.uvIndex}</p>
          </div>
        </div>
      </div>

      <div>
        <Carousel
          setApi={setApi}
          opts={{
            align: 'start',
            slidesToScroll: 'auto',
            startIndex: selectedIndex,
          }}
        >
          <CarouselContent className="-ml-0">
            {weather.hourly.map((forecast, index) => (
              <CarouselItem
                key={index}
                className="basis-[20%] sm:basis-[16.66%] md:basis-[12.5%] lg:basis-[10%]"
              >
                <div
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    'flex flex-col items-center justify-between p-2 border-r h-full min-h-[140px] cursor-pointer',
                    selectedIndex === index
                      ? 'bg-blue-100'
                      : 'bg-card hover:bg-muted/50'
                  )}
                >
                  <p className="text-[10px] sm:text-xs uppercase text-muted-foreground text-center">
                    {format(new Date(forecast.date), 'eee', { locale: fr })}
                  </p>
                  <p className="text-sm font-bold">
                    {format(new Date(forecast.date), "HH'h'", { locale: fr })}
                  </p>
                  <WeatherConditionIcon
                    condition={forecast.condition}
                    isNight={forecast.isNight}
                    className="my-2 size-7"
                  />
                  <div className="flex items-center flex-col gap-1 text-center">
                    <WindArrowIcon direction={forecast.windDirection} />
                    <p className="text-xs font-semibold">{forecast.windSpeed} km/h</p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}
