
'use server';
/**
 * @fileOverview AI flow for providing smart gardening advice based on seeds and moon cycles.
 *
 * - getGardeningAdvice: Analyzes a seed and provides cultural advice and moon compatibility.
 */

import { ai } from '@/ai/genkit';
import {
  GardeningAdviceInputSchema,
  GardeningAdviceOutputSchema,
  type GardeningAdviceInput,
  type GardeningAdviceOutput,
} from '@/ai/schemas';

export async function getGardeningAdvice(input: GardeningAdviceInput): Promise<GardeningAdviceOutput> {
  return gardeningAdviceFlow(input);
}

const gardeningAdvicePrompt = ai.definePrompt({
  name: 'gardeningAdvicePrompt',
  input: { schema: GardeningAdviceInputSchema },
  output: { schema: GardeningAdviceOutputSchema },
  prompt: `Tu es un expert en jardinage tropical, spécialisé dans les traditions de Nouvelle-Calédonie et l'influence de la lune.
Analyse la demande de semis suivante :

GRAINE : {{{seedName}}}
DATE DE SEMIS : {{{sowingDate}}}
PHASE LUNAIRE ACTUELLE : {{{lunarPhase}}}
INFLUENCE DU ZODIAQUE : {{{zodiacSign}}}

TES MISSIONS :
1. Identifie précisément le type de plante.
2. Évalue si le semis est judicieux aujourd'hui par rapport à la lune. Rappel :
   - Lune Montante : Favorable aux parties aériennes (Feuilles, Fruits, Fleurs).
   - Lune Descendante : Favorable aux parties souterraines (Racines) et à la plantation/repiquage.
   - Les signes du Zodiaque (Fruits, Racines, Fleurs, Feuilles) doivent idéalement correspondre au type de plante.
3. Génère des conseils de culture spécifiques au climat calédonien (arrosage, exposition).
4. Calcule une date de récolte estimée réaliste.
5. Suggère une période de repiquage (mise en terre) si applicable.

Réponds avec bienveillance et expertise.`,
});

const gardeningAdviceFlow = ai.defineFlow(
  {
    name: 'gardeningAdviceFlow',
    inputSchema: GardeningAdviceInputSchema,
    outputSchema: GardeningAdviceOutputSchema,
  },
  async (input) => {
    const { output } = await gardeningAdvicePrompt(input);
    return output!;
  }
);
