
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { format, isSameDay, startOfDay, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Sprout, Calendar as CalendarIcon, Info, Trash2, BrainCircuit, AlertTriangle, CheckCircle2, ChevronRight, Droplets, Sun, Shovel, Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGardeningAdvice } from '@/ai/flows/gardening-flow';
import type { GardeningAdviceOutput } from '@/ai/schemas';
import type { LocationData, SowingRecord } from '@/lib/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { generateProceduralData } from '@/lib/data';
import { useLocation } from '@/context/location-context';

const COMMON_SEEDS = [
  "Tomate", "Salade (Laitue)", "Carotte", "Haricot Vert", "Courgette", 
  "Concombre", "Poivron", "Piment", "Aubergine", "Oignon", "Radis",
  "Chou de Chine", "Basilic", "Persil", "Ciboulette"
];

export function GardeningManager({ locationData }: { locationData: LocationData }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedLocation } = useLocation();
  
  const [selectedSeed, setSelectedSeed] = useState<string>("");
  const [customSeed, setCustomSeed] = useState("");
  const [sowingDate, setSowingDate] = useState<Date>(new Date());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sowingsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'sowings'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: savedSowings, isLoading: areSowingsLoading } = useCollection<SowingRecord>(sowingsRef);

  const isNotToday = useMemo(() => {
    return !isSameDay(startOfDay(sowingDate), startOfDay(new Date()));
  }, [sowingDate]);

  const seedName = selectedSeed === "AUTRE" ? customSeed : selectedSeed;

  // Helper to generate upcoming calendar for AI
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

  const handleAddSowing = async () => {
    if (!user || !firestore || !seedName) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez sélectionner une graine.' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const upcomingCalendar = getUpcomingGardeningCalendar(selectedLocation, sowingDate);

      const advice = await getGardeningAdvice({
        seedName,
        sowingDate: sowingDate.toISOString(),
        lunarPhase: locationData.farming.lunarPhase,
        zodiacSign: locationData.farming.zodiac,
        upcomingCalendar
      });

      setIsSaving(true);
      const newSowing = {
        userId: user.uid,
        seedName,
        sowingDate: sowingDate.toISOString(),
        plantType: advice.plantType,
        cultureAdvice: advice.cultureAdvice,
        estimatedHarvestDate: advice.harvestDate,
        transplantingAdvice: advice.transplantingAdvice,
        moonWarning: advice.moonWarning,
        isValidForMoon: advice.isValidForMoon,
        lunarContext: {
          phase: locationData.farming.lunarPhase,
          zodiac: locationData.farming.zodiac
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(firestore, 'users', user.uid, 'sowings'), newSowing);
      
      toast({ 
        title: advice.isValidForMoon ? 'Semis enregistré !' : 'Avertissement Lunaire', 
        description: advice.moonWarning,
        variant: advice.isValidForMoon ? 'default' : 'destructive'
      });
      
      setSelectedSeed("");
      setCustomSeed("");
      setSowingDate(new Date());
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer les conseils IA.' });
    } finally {
      setIsAnalyzing(false);
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'sowings', id));
      toast({ title: 'Entrée supprimée' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur' });
    }
  };

  return (
    <div className="space-y-8 w-full max-w-full overflow-x-hidden">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="text-primary" /> Nouveau Semis
          </CardTitle>
          <CardDescription>Enregistrez vos mises en godets ou semis direct.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date de mise en semis</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-12 px-4", !sowingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {sowingDate ? format(sowingDate, 'PPP', { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={sowingDate} onSelect={(d) => d && setSowingDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
              {isNotToday && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs font-medium italic">
                    Attention : la date saisie ne correspond pas à la date d'aujourd'hui. Est-ce intentionnel ?
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label>Choix de la graine</Label>
              <Select value={selectedSeed} onValueChange={setSelectedSeed}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Sélectionner une variété" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SEEDS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="AUTRE">Autre / Saisie manuelle...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedSeed === "AUTRE" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Nom de la plante</Label>
                <Input 
                  placeholder="Ex: Passion, Chouchoute..." 
                  value={customSeed} 
                  onChange={e => setCustomSeed(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            )}
          </div>

          <Button 
            className="w-full h-12 text-lg font-bold shadow-md" 
            onClick={handleAddSowing} 
            disabled={!seedName || isAnalyzing || isSaving}
          >
            {isAnalyzing ? (
              <><BrainCircuit className="mr-2 animate-pulse" /> Analyse IA...</>
            ) : (
              <><Sprout className="mr-2" /> Valider mon semis</>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2 px-1">
          <CalendarIcon className="size-5 text-primary" /> Mes Cultures en Cours
        </h3>
        
        {areSowingsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : savedSowings && savedSowings.length > 0 ? (
          <div className="grid gap-6">
            {savedSowings.map((record) => (
              <Card key={record.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold text-primary">{record.seedName}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1 font-medium">
                        Semé le {format(new Date(record.sowingDate), 'd MMMM yyyy', { locale: fr })}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)} className="text-destructive/50 hover:text-destructive">
                      <Trash2 className="size-5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{record.plantType}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                      Lune {record.lunarContext?.phase === 'Lune Montante' ? '↗' : '↘'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                  {record.moonWarning && !record.isValidForMoon && (
                    <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                      <AlertTriangle className="size-4" />
                      <AlertDescription className="text-xs font-semibold">
                        {record.moonWarning}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-3 rounded-lg flex gap-3">
                      <Sun className="size-5 text-accent shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Conseils IA</p>
                        <p className="text-sm leading-relaxed">{record.cultureAdvice}</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg flex gap-3">
                      <Shovel className="size-5 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Mise en terre</p>
                        <p className="text-sm leading-relaxed">{record.transplantingAdvice}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600">
                      <Wheat className="size-5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground leading-none">Récolte estimée</p>
                        <p className="font-bold">{record.estimatedHarvestDate}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="size-6 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-xl">
            Aucun semis enregistré pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
