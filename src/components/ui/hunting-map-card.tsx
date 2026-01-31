'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, MapPin } from 'lucide-react';

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

const huntingZones = [
    { name: "Zone Nord", x: '45%', y: '25%' },
    { name: "Zone Centre", x: '42%', y: '65%' },
    { name: "Zone Îles", x: '78%', y: '55%' },
    { name: "Zone Sud", x: '65%', y: '88%'}
]

export function HuntingMapCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="size-5 text-primary" />
          Carte de chasse
        </CardTitle>
        <CardDescription>
          Carte simplifiée avec quelques zones de chasse notables. La fonction hors-ligne est en développement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-[4/3] text-muted-foreground/30">
            <NewCaledoniaMap />
            {huntingZones.map(zone => (
                <div key={zone.name} className="absolute group" style={{ left: zone.x, top: zone.y, transform: 'translate(-50%, -100%)' }}>
                    <MapPin className="size-6 text-destructive fill-destructive/50 cursor-pointer" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-card text-card-foreground text-xs px-2 py-1 rounded shadow-lg">
                        {zone.name}
                    </div>
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
