
'use client';

import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WindDirection } from '@/lib/types';
import { useLocation } from '@/context/location-context';

const directionToRotation: Record<WindDirection, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

const NewCaledoniaMap = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className="w-full h-full"
      fill="currentColor"
    >
        {/* Grande Terre */}
        <path d="M94.6,23.3C60,80,60,130,90,180c40-40,40-80,10-140C98.6,33.3,96.6,28.3,94.6,23.3z"/>
        {/* Belep */}
        <path d="M91.6,18.3c-2-1-1-4,1-3C92.6,16.3,92.6,17.3,91.6,18.3z"/>
        <path d="M87.6,14.3c-2-1-1-4,1-3C88.6,12.3,88.6,13.3,87.6,14.3z"/>
        {/* Ouvea */}
        <path d="M152,70c-12,15,0,30,5,25C162,85,162,75,152,70z"/>
        {/* Lifou */}
        <path d="M165,105c-12,20,0,35,8,30C178,125,175,110,165,105z"/>
        {/* Maré */}
        <path d="M185,140c-8,15,2,28,8,22C198,155,193,145,185,140z"/>
        {/* Ile des Pins */}
        <path d="M125,170c-10,12,0,25,10,20C140,185,135,175,125,170z"/>
    </svg>
);

const TahitiMap = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className="w-full h-full"
      fill="currentColor"
    >
        {/* Tahiti Nui (Le gros rond) */}
        <path d="M110,100 c0,25-20,45-45,45 s-45-20-45-45 s20-45,45-45 s45,20,45,45 Z" />
        {/* Tahiti Iti (La petite presqu'île) */}
        <path d="M110,100 c20,0,40,15,40,35 s-15,35-35,35 s-35-15-35-35 Z" />
        {/* Moorea (À gauche) */}
        <path d="M30,85 L55,105 L25,115 Z" />
    </svg>
);


export const WindMap = ({
  direction,
  className,
}: {
  direction: WindDirection;
  className?: string;
}) => {
  const { selectedRegion } = useLocation();
  const rotation = directionToRotation[direction] || 0;
  
  return (
    <div className={cn('relative w-24 h-48', className)}>
      <div className="absolute inset-0 text-muted-foreground/30">
        {selectedRegion === 'TAHITI' ? <TahitiMap /> : <NewCaledoniaMap />}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ArrowUp
          className="size-1/2 text-primary drop-shadow-md"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
    </div>
  );
};
