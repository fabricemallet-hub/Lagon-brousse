
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Ban, 
  Check, 
  Scale, 
  BookOpen, 
  Crosshair, 
  LifeBuoy, 
  ShieldCheck, 
  Info, 
  Zap, 
  Plus, 
  ClipboardCheck, 
  Lightbulb, 
  ShieldAlert, 
  FileText,
  Fish,
  Leaf,
  PhoneCall
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VesselSafetyManager } from '@/components/vessel-safety-manager';

const fishingCalendarData = [
  {
    name: 'Picot',
    forbidden: [8, 9, 10, 11, 0], // Sep, Oct, Nov, Dec, Jan
    details: 'Pêche et vente interdites du 1er septembre au 31 janvier.',
  },
  {
    name: 'Crabe de palétuvier',
    forbidden: [11, 0], // Dec, Jan
    details: 'Pêche et vente interdites du 1er décembre au 31 janvier.',
  },
  {
    name: 'Huître roche ou de palétuvier',
    forbidden: [8, 9, 10, 11, 0, 1, 2, 3], // Sep to Apr
    details: 'Pêche et vente interdites du 1er septembre au 30 avril.',
  },
  {
    name: 'Espèces intégralement protégées',
    forbidden: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    details: 'Interdiction totale de pêche/capture pour : tricot rayé, tortue, dugong, cétacés, requin, napoléon, volute, toutoute, casque, nautile, oiseaux marins.',
  },
  {
    name: 'Corail',
    forbidden: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    details: "Récolte des coraux vivants interdite toute l'année.",
  },
];

const huntingCalendarData = [
  {
    name: 'Notou',
    allowed: [3], // Avril
    details: 'Chasse ouverte uniquement les week-ends d\'avril. Quota : 5/chasseur/jour.',
  },
  {
    name: 'Roussette',
    allowed: [3], // Avril
    details: 'Chasse autorisée uniquement les week-ends du mois d\'avril. Quota : 5/chasseur/jour.',
  },
  {
    name: 'Gibier d\'eau (Canards, Sarcelle)',
    allowed: [6, 7, 8, 9, 10], // Juillet à Novembre
    details: 'Chasse autorisée du 1er juillet au 30 novembre inclus.',
  },
  {
    name: 'Gibier terrestre',
    allowed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Toute l'année
    details: 'Chasse autorisée sans quota. Inclut : Cerf, cochon, lapin, chèvre, faisan, dindon, canard Colvert, poule Sultane.',
  },
];

const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function ReglementationPage() {
  return (
    <div className="space-y-6 pb-24 px-1">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-2 pb-4">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Réglementation & Conseils</CardTitle>
          <CardDescription className="text-xs font-bold uppercase opacity-60">
            Guide officiel et bonnes pratiques du terroir calédonien.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="regles" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 mb-6 border-2">
          <TabsTrigger value="regles" className="font-black uppercase text-[10px]">Réglementation</TabsTrigger>
          <TabsTrigger value="conseils" className="font-black uppercase text-[10px]">Conseils Pratiques</TabsTrigger>
        </TabsList>

        <TabsContent value="regles" className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
          {/* SECTION SÉCURITÉ MARITIME */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
                <LifeBuoy className="text-primary size-5" />
                Sécurité & Armement des Navires
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase opacity-70">
                Réglementation adaptée localement (Délibération n°119/CP de 2018).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs font-medium leading-relaxed italic text-muted-foreground border-l-4 border-primary pl-3 py-1">
                En Nouvelle-Calédonie, le contenu de votre "boîte" ou armement de sécurité dépend de votre distance d'un abri.
              </p>

              <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="basique" className="border-2 rounded-xl bg-card overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase">
                    1. Navigation Basique ({"<"} 2 milles)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-primary">Minimum pour le lagon proche ou les baies :</p>
                      <ul className="space-y-2">
                        <li className="flex gap-2 text-xs font-medium">
                          <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                          <span><strong>EIF :</strong> Un gilet par personne, minimum 50 Newtons.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-medium">
                          <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                          <span><strong>Dispositif lumineux :</strong> Lampe torche étanche ou flash-light (6h).</span>
                        </li>
                        <li className="flex gap-2 text-xs font-medium">
                          <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                          <span><strong>Incendie :</strong> Extincteur(s) selon préconisations.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-medium">
                          <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                          <span><strong>Remorquage :</strong> Point d'amarrage et ligne de mouillage.</span>
                        </li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cotiere" className="border-2 rounded-xl bg-card overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase">
                    2. Navigation Côtière ({"<"} 6 milles)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-primary">Sorties aux îlots. Matériel "Basique" + :</p>
                      <ul className="space-y-2">
                        <li className="flex gap-2 text-xs font-medium">
                          <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                          <span><strong>Gilets :</strong> Doivent passer à 100 Newtons minimum.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-medium">
                          <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                          <span><strong>Signalisation :</strong> 3 feux rouges à main.</span>
                        </li>
                        <li className="flex gap-2 text-xs font-medium">
                          <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                          <span><strong>Compas :</strong> Magnétique étanche et fixé.</span>
                        </li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="recos" className="border-2 rounded-xl bg-amber-50 border-amber-200 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase text-amber-900">
                    <div className="flex items-center gap-2"><Zap className="size-4 fill-amber-500 text-amber-500" /> Vos Équipements</div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                    <VesselSafetyManager />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
                <BookOpen className="text-primary size-5" />
                Calendrier des Pêches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {fishingCalendarData.map((item) => (
                <div key={item.name} className="border-b last:border-0 pb-6 last:pb-0">
                  <h4 className="font-bold text-sm mb-3 uppercase tracking-tight">{item.name}</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1 mb-2">
                    {months.map((month, index) => (
                      <div
                        key={month}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-md h-12 text-center p-1',
                          item.forbidden.includes(index)
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-green-600/10 text-green-800'
                        )}
                      >
                        <span className="text-[9px] font-black uppercase">{month}</span>
                        {item.forbidden.includes(index) ? (
                          <Ban className="size-3.5 mt-1" />
                        ) : (
                          <Check className="size-3.5 mt-1 text-green-600" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground italic leading-tight">{item.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
                <Crosshair className="text-primary size-5" />
                Calendrier de Chasse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {huntingCalendarData.map((item) => (
                <div key={item.name} className="border-b last:border-0 pb-6 last:pb-0">
                  <h4 className="font-bold text-sm mb-3 uppercase tracking-tight">{item.name}</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1 mb-2">
                    {months.map((month, index) => (
                      <div
                        key={month}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-md h-12 text-center p-1',
                          item.allowed.includes(index)
                            ? 'bg-green-600/10 text-green-800'
                            : 'bg-destructive/10 text-destructive'
                        )}
                      >
                        <span className="text-[9px] font-black uppercase">{month}</span>
                        {item.allowed.includes(index) ? (
                          <Check className="size-3.5 mt-1 text-green-600" />
                        ) : (
                          <Ban className="size-3.5 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground italic leading-tight">{item.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conseils" className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
          {/* PÊCHE */}
          <Card className="overflow-hidden border-2 shadow-lg">
            <CardHeader className="bg-cyan-600 text-white p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Fish className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Préparer une sortie pêche</CardTitle>
                  <CardDescription className="text-white/70 font-bold uppercase text-[10px]">Pêche</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-black uppercase text-xs text-slate-800">
                  <ClipboardCheck className="size-4 text-cyan-600" /> Étapes à suivre
                </h4>
                <div className="grid gap-4">
                  {[
                    "Vérifier les horaires de marée",
                    "Consulter la météo",
                    "Préparer le matériel (cannes, appâts, glacière)",
                    "Vérifier l'équipement de sécurité",
                    "Informer vos proches de votre itinéraire"
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="size-7 rounded-full bg-cyan-50 border-2 border-cyan-100 flex items-center justify-center text-[10px] font-black text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl space-y-2">
                <p className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2">
                  <Lightbulb className="size-3" /> Conseils Pratiques
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Partez 1h avant la marée haute
                  </li>
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Emportez suffisamment d'eau et de protection solaire
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* CHASSE */}
          <Card className="overflow-hidden border-2 shadow-lg">
            <CardHeader className="bg-orange-600 text-white p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Crosshair className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Organiser une chasse en brousse</CardTitle>
                  <CardDescription className="text-white/70 font-bold uppercase text-[10px]">Chasse</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-black uppercase text-xs text-slate-800">
                  <ClipboardCheck className="size-4 text-orange-600" /> Étapes à suivre
                </h4>
                <div className="grid gap-4">
                  {[
                    "Vérifier la période d'ouverture",
                    "Obtenir les permis nécessaires",
                    "Préparer l'équipement (arme, munitions, vêtements)",
                    "Repérer la zone de chasse",
                    "Partir tôt le matin (avant l'aube)"
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="size-7 rounded-full bg-orange-50 border-2 border-orange-100 flex items-center justify-center text-[10px] font-black text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl space-y-2">
                <p className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2">
                  <Lightbulb className="size-3" /> Conseils Pratiques
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Portez toujours un gilet orange
                  </li>
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Ne chassez jamais seul
                  </li>
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Respectez les zones interdites
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* JARDINAGE */}
          <Card className="overflow-hidden border-2 shadow-lg">
            <CardHeader className="bg-green-600 text-white p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Leaf className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Planifier les travaux de jardinage</CardTitle>
                  <CardDescription className="text-white/70 font-bold uppercase text-[10px]">Jardinage</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-black uppercase text-xs text-slate-800">
                  <ClipboardCheck className="size-4 text-green-600" /> Étapes à suivre
                </h4>
                <div className="grid gap-4">
                  {[
                    "Consulter la phase lunaire",
                    "Vérifier la météo de la semaine",
                    "Préparer les outils et graines",
                    "Choisir le bon moment (matin ou soir)",
                    "Arroser après la plantation"
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="size-7 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center text-[10px] font-black text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl space-y-2">
                <p className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-2">
                  <Lightbulb className="size-3" /> Conseils Pratiques
                </p>
                <ul className="space-y-1.5 pl-1">
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Jardinez tôt le matin pour éviter la chaleur
                  </li>
                  <li className="text-sm font-bold text-amber-900 flex items-start gap-2">
                    <span className="mt-1.5 size-1 bg-amber-400 rounded-full shrink-0" />
                    Paillez le sol pour conserver l'humidité
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* SÉCURITÉ GENERALE */}
          <Card className="border-2 border-red-200 bg-red-50/30 overflow-hidden shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-black uppercase text-base text-red-800">
                <ShieldAlert className="size-5" /> Consignes de Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                "Toujours informer quelqu'un de votre destination et heure de retour prévue",
                "Emporter un téléphone chargé et les numéros d'urgence",
                "Vérifier les conditions météo avant de partir",
                "Respecter les réglementations en vigueur"
              ].map((rule, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-red-100 shadow-sm">
                  <ShieldCheck className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-xs font-bold leading-tight text-red-950">{rule}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-red-100 mt-2">
                <p className="text-[9px] font-black uppercase text-red-600/60 text-center tracking-widest">Sécurité Priorité Absolue</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
