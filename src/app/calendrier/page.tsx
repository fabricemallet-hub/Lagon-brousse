
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
import { Fish, Leaf } from 'lucide-react';

export default function CalendrierPage() {
  const { calendarView, setCalendarView } = useCalendarView();

  return (
    <div className="space-y-6 w-full">
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
    </div>
  );
}
