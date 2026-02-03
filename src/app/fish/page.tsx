'use client';

import { useState, useRef } from 'react';
import { lagoonFishData } from '@/lib/fish-data';
import type { FishSpeciesInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Camera, Fish, Info, AlertTriangle, ChefHat, Target, Sparkles, BrainCircuit, X, CheckCircle2 } from 'lucide-react';
import { identifyFish } from '@/ai/flows/identify-fish-flow';
import type { IdentifyFishOutput } from '@/ai/schemas';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FishPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [aiResult, setAiResult] = useState<IdentifyFishOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFish = lagoonFishData.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.scientificName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIdentifying(true);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await identifyFish({ photoDataUri: base64 });
        setAiResult(result);
      } catch (error) {
        console.error(error);
        toast({ 
          variant: 'destructive', 
          title: "Erreur d'analyse", 
          description: "Impossible d'identifier le poisson. Vérifiez votre connexion." 
        });
      } finally {
        setIsIdentifying(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Fish className="text-primary size-7" /> Guide des Poissons NC
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            Identifiez vos prises et découvrez comment les savourer en toute sécurité.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un poisson..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 border-2"
          />
        </div>

        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="h-14 text-lg font-black uppercase tracking-widest shadow-lg gap-3"
          disabled={isIdentifying}
        >
          {isIdentifying ? (
            <BrainCircuit className="size-6 animate-pulse" />
          ) : (
            <Camera className="size-6" />
          )}
          {isIdentifying ? "Identification..." : "Prendre en Photo (IA)"}
        </Button>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleCapture} 
          className="hidden" 
        />
      </div>

      {aiResult && (
        <Card className="border-2 border-primary bg-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
          <button 
            onClick={() => setAiResult(null)}
            className="absolute top-2 right-2 p-1 bg-primary/10 rounded-full hover:bg-primary/20 text-primary"
          >
            <X className="size-4" />
          </button>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-4 text-primary" />
              <Badge variant="default" className="text-[10px] font-black uppercase">Analyse IA Réussie</Badge>
            </div>
            <CardTitle className="text-xl font-black uppercase text-primary leading-none">
              {aiResult.name}
            </CardTitle>
            <CardDescription className="italic font-medium">{aiResult.scientificName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-white/50 backdrop-blur rounded-lg border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Risque de Gratte (Ciguatera)</span>
                <span className={cn("text-xs font-black", aiResult.gratteRisk > 30 ? "text-red-600" : "text-green-600")}>
                  {aiResult.gratteRisk}%
                </span>
              </div>
              <Progress value={aiResult.gratteRisk} className={cn("h-2", aiResult.gratteRisk > 30 ? "bg-red-100 [&>div]:bg-red-500" : "bg-green-100 [&>div]:bg-green-500")} />
              <p className="text-[10px] italic leading-tight opacity-70">L'indice est une estimation basée sur l'espèce. Soyez toujours prudent en zone suspecte.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0"><Target className="size-4" /></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pêche</p>
                  <p className="text-xs font-medium leading-relaxed">{aiResult.fishingAdvice}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-accent/10 rounded-lg text-accent shrink-0"><ChefHat className="size-4" /></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuisine</p>
                  <p className="text-xs font-medium leading-relaxed">{aiResult.culinaryAdvice}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600 shrink-0"><Info className="size-4" /></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description physique</p>
                  <p className="text-xs font-medium leading-relaxed italic">{aiResult.description}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Fish className="size-4" /> Liste des espèces communes
        </h3>
        
        <div className="grid gap-3">
          {filteredFish.map((fish) => (
            <Card key={fish.id} className="overflow-hidden border-2 hover:border-primary/30 transition-all">
              <Accordion type="single" collapsible>
                <AccordionItem value={fish.id} className="border-none">
                  <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:bg-muted/30">
                    <div className="flex items-center gap-4 text-left w-full">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Fish className="size-6 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h4 className="font-black uppercase tracking-tighter text-base leading-none truncate">{fish.name}</h4>
                        <p className="text-[10px] text-muted-foreground italic truncate mt-1">{fish.scientificName}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-2 pr-4">
                        <Badge 
                          variant={fish.gratteRisk > 20 ? "destructive" : "outline"} 
                          className={cn("text-[8px] h-5 font-black uppercase", fish.gratteRisk <= 20 && "border-green-500 text-green-600")}
                        >
                          Gratte {fish.gratteRisk}%
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 space-y-4 bg-muted/10 border-t border-dashed">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary">
                          <Target className="size-3" /> Conseils Pêche
                        </div>
                        <p className="text-xs font-medium leading-relaxed">{fish.fishingAdvice}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-accent">
                          <ChefHat className="size-3" /> Conseils Cuisine
                        </div>
                        <p className="text-xs font-medium leading-relaxed">{fish.culinaryAdvice}</p>
                      </div>
                    </div>
                    {fish.gratteRisk > 30 && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-800">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold leading-tight">
                          Prudence : Cette espèce présente un risque de ciguatera élevé. Évitez les gros spécimens.
                        </p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
