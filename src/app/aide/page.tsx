
'use client';

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const helpSections = [
  {
    id: 'accueil',
    title: 'Accueil',
    description: 'Le résumé de votre journée.',
    icon: Home,
    color: 'bg-blue-500',
  },
  {
    id: 'lagon',
    title: 'Lagon & Météo',
    description: 'Vent, marées et houle.',
    icon: Waves,
    color: 'bg-cyan-500',
  },
  {
    id: 'vessel-tracker',
    title: 'Vessel Tracker',
    description: 'Sécurité et partage GPS.',
    icon: Navigation,
    color: 'bg-blue-600',
  },
  {
    id: 'peche',
    title: 'Pêche',
    description: 'Prévisions et carnet de pêche.',
    icon: Fish,
    color: 'bg-indigo-500',
  },
  {
    id: 'chasse',
    title: 'Chasse',
    description: 'Cerf, vent et sessions.',
    icon: Crosshair,
    color: 'bg-orange-600',
  },
  {
    id: 'champs',
    title: 'Champs',
    description: 'Jardiner avec la lune.',
    icon: Leaf,
    color: 'bg-green-600',
  },
  {
    id: 'semis',
    title: 'Guide Culture',
    description: 'Planification par IA.',
    icon: Sprout,
    color: 'bg-emerald-500',
  },
  {
    id: 'calendrier-peche',
    title: 'Calendrier Pêche',
    description: 'Cycles lunaires marins.',
    icon: Calendar,
    color: 'bg-slate-700',
  },
  {
    id: 'calendrier-champs',
    title: 'Calendrier Champs',
    description: 'Zodiaque et plantations.',
    icon: Calendar,
    color: 'bg-green-800',
  },
  {
    id: 'reglementation',
    title: 'Réglementation',
    description: 'Tailles et périodes de fermeture.',
    icon: Scale,
    color: 'bg-slate-500',
  },
  {
    id: 'compte',
    title: 'Compte',
    description: 'Abonnement et profil.',
    icon: User,
    color: 'bg-zinc-600',
  }
];

export default function AidePage() {
  return (
    <div className="space-y-6 pb-12 w-full max-w-full overflow-x-hidden">
      <div className="px-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="text-primary" /> Mode opératoire
        </h1>
        <p className="text-muted-foreground mt-1">
          Découvrez comment utiliser toutes les fonctionnalités de votre application.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {helpSections.map((section) => (
          <Link href={`/aide/${section.id}`} key={section.id} className="block group">
            <Card className="h-full hover:border-primary/50 transition-all active:scale-95 touch-none overflow-hidden border-2">
              <CardHeader className="p-4 flex flex-col items-center text-center space-y-3">
                <div className={cn("p-3 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform", section.color)}>
                  <section.icon className="size-6" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm font-bold leading-tight">{section.title}</CardTitle>
                  <CardDescription className="text-[10px] leading-tight hidden sm:block">
                    {section.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
