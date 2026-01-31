'use client';
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Fish, Loader, Sparkles } from 'lucide-react';
import { getFishingPrediction, type PredictionState } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { FishingSuccessOutput } from '@/ai/flows/fishing-success-prediction';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const initialState: PredictionState = {
  data: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader className="mr-2 h-4 w-4 animate-spin" />
          Prédiction...
        </>
      ) : (
        'Le poisson va-t-il mordre ?'
      )}
    </Button>
  );
}

export function FishingPredictor() {
  const [state, formAction] = useFormState(getFishingPrediction, initialState);
  const [prediction, setPrediction] = useState<FishingSuccessOutput | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Erreur de prédiction',
        description: state.error,
      });
    }
    if (state.data) {
      setPrediction(state.data);
    }
  }, [state, toast]);

  const isGoodDay = prediction && prediction.successLikelihood > 70;

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fish
            className={cn(
              'transition-colors',
              isGoodDay && 'text-accent glow'
            )}
          />
          Indice de Pêche
        </CardTitle>
        <CardDescription>
          Prédisez vos chances de succès pour la pêche à la ligne.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tideCondition">Condition de marée</Label>
            <Select name="tideCondition" required>
              <SelectTrigger id="tideCondition">
                <SelectValue placeholder="Sélectionnez..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marée montante">Marée montante</SelectItem>
                <SelectItem value="marée descendante">Marée descendante</SelectItem>
                <SelectItem value="marée haute">Marée haute (étale)</SelectItem>
                <SelectItem value="marée basse">Marée basse (étale)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeOfDay">Heure de la journée</Label>
            <Select name="timeOfDay" required>
              <SelectTrigger id="timeOfDay">
                <SelectValue placeholder="Sélectionnez..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aube">Aube</SelectItem>
                <SelectItem value="matin">Matin</SelectItem>
                <SelectItem value="après-midi">Après-midi</SelectItem>
                <SelectItem value="crépuscule">Crépuscule</SelectItem>
                <SelectItem value="nuit">Nuit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lunarPhase">Phase lunaire</Label>
            <Select name="lunarPhase" required>
              <SelectTrigger id="lunarPhase">
                <SelectValue placeholder="Sélectionnez..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nouvelle lune">Nouvelle lune</SelectItem>
                <SelectItem value="premier quartier">Premier quartier</SelectItem>
                <SelectItem value="pleine lune">Pleine lune</SelectItem>
                <SelectItem value="dernier quartier">Dernier quartier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <SubmitButton />
          {prediction && (
            <Alert
              className="w-full"
              variant={isGoodDay ? 'default' : 'destructive'}
            >
              <Sparkles className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>Résultat de la prédiction</span>
                <span
                  className={cn(
                    'font-bold text-lg',
                    isGoodDay ? 'text-green-600' : 'text-destructive'
                  )}
                >
                  {prediction.successLikelihood}%
                </span>
              </AlertTitle>
              <AlertDescription>{prediction.reasoning}</AlertDescription>
            </Alert>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
