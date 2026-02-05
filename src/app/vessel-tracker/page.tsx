'use client';

import { VesselTracker } from '@/components/vessel-tracker';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Navigation } from 'lucide-react';

export default function VesselTrackerPage() {
  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6 pb-8 px-1">
      <Card className="w-full border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Navigation className="text-primary size-6" /> Vessel Tracker
          </CardTitle>
          <CardDescription className="text-xs">Sécurité maritime et partage de position GPS en temps réel.</CardDescription>
        </CardHeader>
      </Card>
      
      <VesselTracker />
    </div>
  );
}
