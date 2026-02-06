'use server';
/**
 * @fileOverview AI flows for analyzing fishing data to predict best fishing days.
 *
 * - findSimilarDay: Finds a day with conditions similar to a past successful catch.
 * - analyzeBestDay: Analyzes multiple past catches to find an optimal day in the near future.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { generateProceduralData } from '@/lib/data';
import type { LocationData } from '@/lib/types';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AnalyzeBestDayInputSchema,
  FindSimilarDayInputSchema,
  FishingAnalysisOutputSchema,
  FishingSpotContextSchema,
  type AnalyzeBestDayInput,
  type FindSimilarDayInput,
  type FishingAnalysisOutput,
} from '@/ai/schemas';

// Wrapper Functions
export async function findSimilarDay(input: FindSimilarDayInput): Promise<FishingAnalysisOutput> {
  return findSimilarDayFlow(input);
}

export async function analyzeBestDay(input: AnalyzeBestDayInput): Promise<FishingAnalysisOutput> {
  return analyzeBestDayFlow(input);
}


// Helper to generate future data
function getFutureForecasts(location: string, searchRangeDays: number): { date: string, data: LocationData }[] {
  const forecasts = [];
  const today = new Date();
  for (let i = 1; i <= searchRangeDays; i++) {
    const futureDate = addDays(today, i);
    const data = generateProceduralData(location, futureDate);
    forecasts.push({
      date: format(futureDate, 'yyyy-MM-dd'),
      data,
    });
  }
  return forecasts;
}

function formatForecastForPrompt(forecast: { date: string, data: LocationData }): string {
    const { date, data } = forecast;
    const dayOfWeek = format(new Date(date), 'eeee', { locale: fr });
    const tides = data.tides.map(t => `${t.type} à ${t.time} (${t.height}m)`).join(', ');

    return `
- Jour: ${date} (${dayOfWeek})
  - Lune: ${data.weather.moon.phase} (${data.weather.moon.percentage}% visible)
  - Marées: ${tides}
`;
}

// Flow 1: Find Similar Day
const findSimilarDayPrompt = ai.definePrompt({
  name: 'findSimilarDayPrompt',
  input: { 
    schema: z.object({
      pastDate: z.string(),
      spotContext: FishingSpotContextSchema,
      futureForecasts: z.string(),
    }) 
  },
  output: { schema: FishingAnalysisOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `Tu es un expert en pêche en Nouvelle-Calédonie. Analyse les conditions d'une prise passée et trouve le jour le plus similaire dans les prévisions futures.
IMPORTANT: Pour cette analyse, concentre-toi EXCLUSIVEMENT sur la marée et la lune. Ignore totalement le vent, la houle et la météo.

CONDITIONS DE LA PRISE PASSÉE:
- Date: {{{pastDate}}}
- Marée: Mouvement {{{spotContext.tideMovement}}}, Courant {{{spotContext.tideCurrent}}}, Hauteur ~{{{spotContext.tideHeight}}}m
- Lune: {{{spotContext.moonPhase}}}

PRÉVISIONS DES JOURS À VENIR:
{{{futureForecasts}}}

TA MISSION:
1. Compare chaque jour futur aux conditions de la prise passée uniquement sur les critères de marée et de lune.
2. Évalue l'importance de ces deux facteurs.
3. Choisis le **MEILLEUR** jour qui maximise les chances de recréer le succès passé au niveau du cycle de marée et de lune.
4. Attribue un score de confiance de 0 à 100.
5. Fournis une explication claire et concise, en comparant les facteurs clés (marée/lune) qui justifient ton choix.

Réponds uniquement au format JSON requis.`,
});

const findSimilarDayFlow = ai.defineFlow(
  {
    name: 'findSimilarDayFlow',
    inputSchema: FindSimilarDayInputSchema,
    outputSchema: FishingAnalysisOutputSchema,
  },
  async (input) => {
    const futureForecasts = getFutureForecasts(input.location, input.searchRangeDays);
    const formattedForecasts = futureForecasts.map(formatForecastForPrompt).join('');

    const promptData = {
      spotContext: input.spotContext,
      pastDate: format(new Date(input.spotContext.timestamp), 'eeee d MMMM yyyy', { locale: fr }),
      futureForecasts: formattedForecasts,
    };
    
    const { output } = await findSimilarDayPrompt(promptData);
    return output!;
  }
);


// Flow 2: Analyze Best Day from multiple spots
const analyzeBestDayPrompt = ai.definePrompt({
    name: 'analyzeBestDayPrompt',
    input: { 
      schema: z.object({
        pastContexts: z.string(),
        futureForecasts: z.string(),
      }) 
    },
    output: { schema: FishingAnalysisOutputSchema },
    config: {
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    },
    prompt: `Tu es un expert en pêche en Nouvelle-Calédonie. Un pêcheur te donne les conditions de ses meilleures prises. Ta mission est d'analyser ces succès pour trouver des tendances, puis de recommander le meilleur jour pour pêcher dans la semaine à venir.
IMPORTANT: Concentre-toi EXCLUSIVEMENT sur la marée et la lune. Ignore totalement le vent, la houle et la météo.

CONDITIONS DES PRISES PASSÉES:
{{{pastContexts}}}

PRÉVISIONS DES 7 PROCHAINS JOURS:
{{{futureForecasts}}}

TA MISSION:
1. Analyse les "CONDITIONS DES PRISES PASSÉES" pour identifier les **tendances gagnantes** liées au cycle lunaire et aux marées qui reviennent le plus souvent.
2. Rédige une brève synthèse de ces tendances (ex: "Il semble que vous ayez le plus de succès par marée montante, durant la nouvelle lune.").
3. Compare ces tendances avec les "PRÉVISIONS DES 7 PROCHAINS JOURS".
4. Choisis le **MEILLEUR** jour et créneau horaire qui correspond le mieux à ces tendances gagnantes.
5. Attribue un score de confiance de 0 à 100 pour ta prédiction.
6. Fournis une explication claire : commence par la synthèse des tendances (marée/lune), puis justifie ton choix du meilleur jour futur.

Réponds uniquement au format JSON requis.`,
});

const analyzeBestDayFlow = ai.defineFlow(
    {
      name: 'analyzeBestDayFlow',
      inputSchema: AnalyzeBestDayInputSchema,
      outputSchema: FishingAnalysisOutputSchema,
    },
    async (input) => {
      const futureForecasts = getFutureForecasts(input.location, input.searchRangeDays);
      const formattedForecasts = futureForecasts.map(formatForecastForPrompt).join('');
  
      const formattedPastContexts = input.spotContexts.map(ctx => {
        return `- Prise le ${format(new Date(ctx.timestamp), 'd MMM', {locale: fr})}: Marée ${ctx.tideMovement}, Lune ${ctx.moonPhase}.`;
      }).join('\n');

      const promptData = {
        pastContexts: formattedPastContexts,
        futureForecasts: formattedForecasts,
      };
      
      const { output } = await analyzeBestDayPrompt(promptData);
      return output!;
    }
  );
