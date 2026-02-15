'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LunarCalendar } from '@/components/ui/lunar-calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCalendarView } from '@/context/calendar-view-context';
import { 
  Fish, 
  Leaf, 
  Waves, 
  Info, 
  Scissors, 
  RefreshCw, 
  Spade, 
  Carrot, 
  Flower,
  Zap,
  Star
} from 'lucide-react';
import { CrabIcon, LobsterIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export default function CalendrierPage() {
  const { calendarView, setCalendarView } = useCalendarView();

  return (
    <div className="space-y-6 w-full pb-20">
      <Card className="w-full overflow-visible border-none shadow-none bg-transparent">
        <CardHeader className="px-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tighter">Calendrier Lunaire</CardTitle>
              <CardDescription className="text-xs font-bold uppercase opacity-60">
                Basculer entre Pêche et Champs pour voir les prévisions spécifiques.
              </CardDescription>
            </div>
            
            <Tabs 
              value={calendarView} 
              onValueChange={(v) => setCalendarView(v as 'peche' | 'champs')}
              className="w-full sm:w-[300px]"
            >
              <TabsList className="grid w-full grid-cols-2 h-12 border-2">
                <TabsTrigger value="peche" className="flex items-center gap-2 font-black uppercase text-[10px]">
                  <Fish className="size-4 text-primary" /> Pêche
                </TabsTrigger>
                <TabsTrigger value="champs" className="flex items-center gap-2 font-black uppercase text-[10px]">
                  <Leaf className="size-4 text-green-600" /> Jardin
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-visible">
          <LunarCalendar />
        </CardContent>
      </Card>

      {/* Lexique Dynamique */}
      <Card className="border-2 bg-muted/30 shadow-sm mx-1">
        <CardHeader className="pb-3 border-b border-dashed">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Info className="size-4 text-primary" /> Lexique des icônes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {calendarView === 'peche' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in duration-500">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Potentiel de Pêche (Indice IA)</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-0.5">
                      <Fish className="size-3.5 text-primary fill-primary animate-pulse" />
                      <Fish className="size-3.5 text-primary fill-primary animate-pulse" />
                      <Fish className="size-3.5 text-primary fill-primary animate-pulse" />
                    </div>
                    <span className="text-xs font-black uppercase">Activité Exceptionnelle (9-10/10)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-0.5">
                      <Fish className="size-3.5 text-primary" />
                      <Fish className="size-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-bold">Bonne activité (7-8/10)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Fish className="size-3.5 text-primary opacity-60" />
                    <span className="text-xs font-bold text-muted-foreground">Activité modérée (5-6/10)</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Crustacés & Marées</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-green-100 rounded-lg"><CrabIcon className="size-4 text-green-600" /></div>
                    <span className="text-xs font-bold">Crabe Plein (Vives-eaux)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-red-100 rounded-lg"><CrabIcon className="size-4 text-destructive" /></div>
                    <span className="text-xs font-bold">Crabe Mout (Mue - Mortes-eaux)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg"><LobsterIcon className="size-4 text-blue-600" /></div>
                    <span className="text-xs font-bold">Activité Langouste Élevée</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in duration-500">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Travaux du jour</p>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-3">
                    <Scissors className="size-4 text-orange-600" />
                    <span className="text-xs font-bold">Idéal pour la Taille (Sève descendante)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RefreshCw className="size-4 text-pink-600" />
                    <span className="text-xs font-bold">Idéal Bouturage / Greffage (Sève montante)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Leaf className="size-4 text-green-600" />
                    <span className="text-xs font-bold">Tonte de la pelouse (Repousse lente)</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Influence du Zodiaque</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Spade className="size-4 text-primary opacity-60" />
                    <span className="text-[10px] font-bold uppercase">Fruits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Carrot className="size-4 text-primary opacity-60" />
                    <span className="text-[10px] font-bold uppercase">Racines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flower className="size-4 text-primary opacity-60" />
                    <span className="text-[10px] font-bold uppercase">Fleurs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Leaf className="size-4 text-primary opacity-60" />
                    <span className="text-[10px] font-bold uppercase">Feuilles</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
