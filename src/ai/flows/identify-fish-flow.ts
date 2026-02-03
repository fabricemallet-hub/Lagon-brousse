'use server';
/**
 * @fileOverview AI flow for identifying fish from photos in New Caledonia.
 */

import { ai } from '@/ai/genkit';
import {
  IdentifyFishInputSchema,
  IdentifyFishOutputSchema,
  type IdentifyFishInput,
  type IdentifyFishOutput,
} from '@/ai/schemas';

export async function identifyFish(input: IdentifyFishInput): Promise<IdentifyFishOutput> {
  return identifyFishFlow(input);
}

const identifyFishPrompt = ai.definePrompt({
  name: 'identifyFishPrompt',
  input: { schema: IdentifyFishInputSchema },
  output: { schema: IdentifyFishOutputSchema },
  prompt: `Tu es un expert en biologie marine spécialisé dans les poissons de Nouvelle-Calédonie.
Analyse cette photo de poisson : {{media url=photoDataUri}}

TA MISSION :
1. Identifie l'espèce (nom commun local et nom scientifique).
2. Évalue le risque de "gratte" (ciguatera) pour cette espèce spécifiquement en Nouvelle-Calédonie.
3. Donne des conseils sur la meilleure façon de le cuisiner.
4. Donne des conseils sur comment le pêcher (appâts, technique).
5. Fournis une courte description physique pour que l'utilisateur soit sûr de l'identification.

Réponds avec expertise et précision en français.`,
});

const identifyFishFlow = ai.defineFlow(
  {
    name: 'identifyFishFlow',
    inputSchema: IdentifyFishInputSchema,
    outputSchema: IdentifyFishOutputSchema,
  },
  async (input) => {
    const { output } = await identifyFishPrompt(input);
    return output!;
  }
);
