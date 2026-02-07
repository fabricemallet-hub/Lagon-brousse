'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  Waves, 
  Fish, 
  Crosshair, 
  Leaf, 
  Sprout, 
  Calendar, 
  Scale, 
  Navigation, 
  User,
  Home,
  MessageSquare,
  BookOpen,
  ChevronRight,
  Sun,
  HelpCircle,
  LifeBuoy,
  BrainCircuit
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const helpSections = [
  { id: 'accueil', title: 'Accueil', desc: 'Météo et résumé du jour.', icon: Home, color: 'bg-blue-500' },
  { id: 'lagon', title: 'Lagon', desc: 'Vent, marées et houle.', icon: Waves, color: 'bg-cyan-500' },
  { id: 'meteo', title: 'Météo Live', desc: 'Stations en direct et prévisions J+7.', icon: Sun, color: 'bg-yellow-500' },
  { id: 'vessel-tracker', title: 'Boat Tracker', desc: 'Sécurité et partage GPS.', icon: Navigation, color: 'bg-blue-600' },
  { id: 'peche', title: 'Pêche', desc: 'Indices et carnet de prises.', icon: Fish, color: 'bg-indigo-500' },
  { id: 'fish', title: 'Guide Poissons', desc: 'Expertise Gratte & Communauté.', icon: BrainCircuit, color: 'bg-cyan-600' },
  { id: 'chasse', title: 'Chasse', desc: 'Cerf, vent et balistique.', icon: Crosshair, color: 'bg-orange-600' },
  { id: 'champs', title: 'Champs', desc: 'Jardiner avec la lune.', icon: Leaf, color: 'bg-green-600' },
  { id: 'semis', title: 'Guide Culture', desc: 'Planification par IA.', icon: Sprout, color: 'bg-emerald-500' },
  { id: 'calendrier-peche', title: 'Calendrier Pêche', desc: 'Cycles lunaires marins.', icon: Calendar, color: 'bg-slate-700' },
  { id: 'calendrier-champs', title: 'Calendrier Champs', desc: 'Zodiaque et plantations.', icon: Calendar, color: 'bg-green-800' },
  { id: 'reglementation', title: 'Réglementation', desc: 'Tailles et fermetures.', icon: Scale, color: 'bg-slate-500' },
  { id: 'compte', title: 'Compte', desc: 'Abonnement et profil.', icon: User, color: 'bg-zinc-600' }
];

export default function AidePage() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <div className="px-1">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <BookOpen className="text-primary size-6" /> Mode Opératoire
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Découvrez comment utiliser chaque outil de votre application.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Guides détaillés</h2>
        {helpSections.map((section) => (
          <Link href={`/aide/${section.id}`} key={section.id} className="block group">
            <Card className="hover:border-primary/50 transition-all active:scale-[0.98] border-2 shadow-sm overflow-hidden h-20">
              <div className="flex items-center h-full p-4 gap-4">
                <div className={cn("size-12 rounded-xl text-white flex items-center justify-center shadow-md shrink-0", section.color)}>
                  <section.icon className="size-6" />
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="font-black uppercase tracking-tighter text-sm leading-none">{section.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{section.desc}</p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
