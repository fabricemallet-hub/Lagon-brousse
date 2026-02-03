
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { semisData, type Vegetable } from '@/lib/semis-data';
import {
  Sun,
  Droplets,
  Flower,
  Bug,
  BookHeart,
  Calendar,
  Wheat,
  MapPin,
  BookText,
  Plus,
  BrainCircuit,
  Search,
  Sprout,
  CalendarDays,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Shovel,
  Info,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getGardeningAdvice } from '@/ai/flows/gardening-flow';
import { useLocation } from '@/context/location-context';
import { generateProceduralData, getDataForDate } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { GardeningAdviceOutput } from '@/ai/schemas';

function AdviceDetail({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ElementType;
  title: string;
  content: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-5 text-primary mt-1 flex-shrink-0" />
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{content}</p>
      </div>
    </div>
  );
}

export default function SemisPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedLocation } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState<string | null>(null);
  const [customVeg, setCustomVeg] = useState('');
  const [sowingDate, setSowingDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<GardeningAdviceOutput | null>(null);

  const filteredData = semisData.filter(veg => 
    veg.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUpcomingGardeningCalendar = (location: string, startDate: Date, days: number = 30) => {
    const schedule = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const data = generateProceduralData(location, d);
      schedule.push({
        date: format(d, 'yyyy-MM-dd'),
        phase: data.farming.lunarPhase,
        zodiac: data.farming.zodiac
      });
    }
    return schedule.map(s => `- ${s.date} : ${s.phase}, Jour ${s.zodiac}`).join('\n');
  };

  const handleStartAnalysis = async () => {
    const plantName = selectedVeg === 'CUSTOM' ? customVeg : selectedVeg;
    if (!plantName) return;

    setIsAnalyzing(true);
    setAiAdvice(null);
    try {
      const dateObj = new Date(sowingDate);
      const locationData = getDataForDate(selectedLocation, dateObj);
      const upcomingCalendar = getUpcomingGardeningCalendar(selectedLocation, dateObj);

      const advice = await getGardeningAdvice({
        seedName: plantName,
        sowingDate: dateObj.toISOString(),
        lunarPhase: locationData.farming.lunarPhase,
        zodiacSign: locationData.farming.zodiac,
        upcomingCalendar
      });

      setAiAdvice(advice);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer les conseils IA.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmSowing = async () => {
    if (!user || !firestore || !aiAdvice) return;
    const plantName = selectedVeg === 'CUSTOM' ? customVeg : selectedVeg;
    if (!plantName) return;

    setIsSaving(true);
    try {
      const dateObj = new Date(sowingDate);
      const locationData = getDataForDate(selectedLocation, dateObj);
      const newSowing = {
        userId: user.uid,
        seedName: plantName,
        sowingDate: dateObj.toISOString(),
        plantType: aiAdvice.plantType,
        cultureAdvice: aiAdvice.cultureAdvice,
        estimatedHarvestDate: aiAdvice.harvestDate,
        transplantingAdvice: aiAdvice.transplantingAdvice,
        moonWarning: aiAdvice.moonWarning,
        isValidForMoon: aiAdvice.isValidForMoon,
        lunarContext: {
          phase: locationData.farming.lunarPhase,
          zodiac: locationData.farming.zodiac
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(firestore, 'users', user.uid, 'sowings'), newSowing);
      
      toast({ 
        title: 'Semis enregistré !', 
        description: 'Retrouvez-le dans votre onglet "Mes Semis".'
      });
      
      setIsPlanningOpen(false);
      setSelectedVeg(null);
      setCustomVeg('');
      setAiAdvice(null);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer le semis.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setIsPlanningOpen(false);
    setAiAdvice(null);
    setSelectedVeg(null);
    setCustomVeg('');
  };

  return (
    <div className="space-y-6 pb-12">
      <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Sprout /> Guide & Planificateur</CardTitle>
          <CardDescription className="text-green-50/80">
            Consultez les fiches ou planifiez vos cultures avec l'aide de l'IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-200" />
            <Input 
              placeholder="Rechercher une plante ou ajouter une variété..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-emerald-100/50 pl-10 h-12"
            />
          </div>
        </CardContent>
      </Card>

      {searchQuery && filteredData.length === 0 && (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Sparkles className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Plante non répertoriée ?</h3>
              <p className="text-sm text-muted-foreground">L'IA peut créer une fiche personnalisée pour "{searchQuery}" et l'ajouter à vos semis.</p>
            </div>
            <Button onClick={() => { setSelectedVeg('CUSTOM'); setCustomVeg(searchQuery); setIsPlanningOpen(true); }} className="font-bold">
              Planifier "{searchQuery}" avec l'IA
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conseils de Culture</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {filteredData.map((veg) => (
              <AccordionItem value={veg.name} key={veg.name}>
                <AccordionTrigger className="text-lg hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4 text-left">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{veg.icon}</span>
                      <span className="font-bold">{veg.name}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="flex flex-col sm:flex-row gap-2 pb-4">
                    <Button 
                      className="w-full sm:w-auto font-bold gap-2" 
                      variant="default"
                      onClick={() => { setSelectedVeg(veg.name); setIsPlanningOpen(true); }}
                    >
                      <Plus className="size-4" /> Planifier ce semis
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-muted/50 border">
                    <div className="flex items-start gap-3">
                      <Calendar className="size-5 text-accent mt-1" />
                      <div>
                        <h4 className="font-semibold">Périodes de Semis</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          <li><span className="font-medium">Saison chaude:</span> {veg.sowingSeasonWarm}</li>
                          <li><span className="font-medium">Saison fraîche:</span> {veg.sowingSeasonCool}</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Wheat className="size-5 text-accent mt-1" />
                       <div>
                        <h4 className="font-semibold">Récolte</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          <li><span className="font-medium">Saison chaude:</span> {veg.harvestWarm}</li>
                          <li><span className="font-medium">Saison fraîche:</span> {veg.harvestCool}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <AdviceDetail icon={MapPin} title="Plantation" content={veg.advice.plantingLocation} />
                    <AdviceDetail icon={Sun} title="Exposition" content={veg.advice.sunlight} />
                    <AdviceDetail icon={Droplets} title="Arrosage" content={veg.advice.watering} />
                    <AdviceDetail icon={Flower} title="Sol & Engrais" content={veg.advice.soilFertilizer} />
                    <AdviceDetail icon={Bug} title="Nuisibles" content={veg.advice.pests} />
                    <AdviceDetail icon={BookHeart} title="Astuce du guide" content={veg.advice.grandmaRecipe} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BookText className="size-6 text-primary" />
            Lexique du Jardinier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-bold text-lg text-accent">Engrais Vert : Qu'est-ce que c'est ?</h3>
            <p className="text-muted-foreground mt-1">
              Un engrais vert est une culture que l'on ne récolte pas. On la fauche avant qu'elle ne monte en graine et on l'incorpore au sol pour l'enrichir naturellement.
            </p>
          </div>
          <div className="space-y-4">
             <div className="space-y-1">
                <h4 className="font-semibold">Les Légumineuses (Haricot, Pois, Crotalaire...)</h4>
                <p className="text-sm text-muted-foreground text-pretty">
                  Ces plantes captent l'azote de l'air. En les laissant se décomposer, vous offrez un festin d'azote à vos prochaines cultures.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold">La Phacélie</h4>
                <p className="text-sm text-muted-foreground">
                  Pousse vite, étouffe les mauvaises herbes, aère le sol et attire les abeilles avec ses fleurs violettes.
                </p>
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Planning Dialog */}
      <Dialog open={isPlanningOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sprout className="text-primary" /> Planifier : {selectedVeg === 'CUSTOM' ? customVeg : selectedVeg}
            </DialogTitle>
            <DialogDescription>
              Choisissez votre date. L'IA calculera la fiche de semis et vérifiera la lune.
            </DialogDescription>
          </DialogHeader>

          {!aiAdvice ? (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase text-muted-foreground">Date de mise en semis prévue</label>
                <div className="relative">
                  <Input 
                    type="date" 
                    value={sowingDate}
                    onChange={(e) => setSowingDate(e.target.value)}
                    className="h-12 pl-10"
                  />
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-primary pointer-events-none" />
                </div>
              </div>
              <Button 
                onClick={handleStartAnalysis} 
                className="w-full h-12 text-lg font-bold" 
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <><BrainCircuit className="mr-2 animate-pulse" /> Analyse de la fiche...</>
                ) : (
                  <><BrainCircuit className="mr-2" /> Calculer la fiche avec l'IA</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
              <div className={cn(
                "p-4 rounded-xl border-2 flex gap-3",
                aiAdvice.isValidForMoon ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"
              )}>
                {aiAdvice.isValidForMoon ? <CheckCircle2 className="size-6 text-green-600 shrink-0" /> : <AlertTriangle className="size-6 text-amber-600 shrink-0" />}
                <div className="space-y-1">
                  <p className="font-bold text-sm">{aiAdvice.isValidForMoon ? "Période idéale !" : "Date déconseillée"}</p>
                  <p className="text-xs leading-relaxed font-medium">{aiAdvice.moonWarning}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Catégorie</div>
                  <div className="font-bold text-sm flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="bg-primary/5">{aiAdvice.plantType}</Badge>
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Récolte estimée</div>
                  <div className="font-bold text-sm mt-1">{aiAdvice.harvestDate}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <Info className="size-3" /> Fiche Technique IA
                </h4>
                <div className="space-y-3">
                  <AdviceDetail icon={Sun} title="Culture & Exposition" content={aiAdvice.cultureAdvice} />
                  <AdviceDetail icon={Shovel} title="Mise en terre (Repiquage)" content={aiAdvice.transplantingAdvice} />
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row pt-4 border-t">
                <Button variant="ghost" onClick={() => setAiAdvice(null)} className="w-full sm:w-auto">Modifier la date</Button>
                <Button onClick={handleConfirmSowing} disabled={isSaving} className="w-full sm:flex-1 font-bold">
                  {isSaving ? "Enregistrement..." : "Confirmer & Enregistrer"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
