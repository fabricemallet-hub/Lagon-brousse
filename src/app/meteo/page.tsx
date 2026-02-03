'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wind, Thermometer, Sun, MapPin, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { MeteoLive } from '@/lib/types';
import { translateWindDirection } from '@/lib/utils';

export default function MeteoLivePage() {
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  
  const meteoQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meteo_caledonie');
  }, [firestore]);

  const { data: rawCommunes, isLoading } = useCollection<MeteoLive>(meteoQuery);

  const communes = rawCommunes?.filter(c => 
    c.id.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Sun className="text-primary size-7" /> Météo NC Live
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            Données en temps réel de la collection <code className="bg-muted px-1 rounded">meteo_caledonie</code>.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Rechercher une commune..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 border-2"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : communes && communes.length > 0 ? (
        <div className="flex flex-col gap-3">
          {communes.map((commune) => (
            <Card key={commune.id} className="overflow-hidden border-2 shadow-sm active:scale-[0.98] transition-transform">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="size-6 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-black uppercase tracking-tighter text-sm leading-none">{commune.id}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-[10px] font-black text-blue-600 dark:text-blue-400">
                        <Wind className="size-3" /> {commune.vent} ND {commune.direction && `(${translateWindDirection(commune.direction)})`}
                      </div>
                      <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded text-[10px] font-black text-orange-600 dark:text-orange-400">
                        <Thermometer className="size-3" /> {commune.temperature}°C
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Indice UV</span>
                  <Badge className="font-black h-7 px-3 text-xs bg-accent text-white border-none shadow-md">
                    {commune.uv}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 border-4 border-dashed rounded-3xl flex flex-col items-center gap-4 opacity-40">
          <Sun className="size-12" />
          <p className="font-black uppercase tracking-widest text-xs">Aucune commune trouvée</p>
        </div>
      )}
      
      <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest mt-4">
        Mise à jour automatique par flux Firestore
      </p>
    </div>
  );
}
