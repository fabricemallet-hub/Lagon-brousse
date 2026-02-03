
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

CALENDRIER DES 30 PROCHAINS JOURS :
{{{upcomingCalendar}}}

TES MISSIONS :
1. Identifie précisément le type de plante (Fruit, Racine, Fleur, ou Feuille).
2. Évalue si le semis est judicieux AUJOURD'HUI. Rappel des règles d'or :
   - Légumes FRUITS (Tomate, Poivron...) -> Jour FRUITS + Lune Montante.
   - Légumes RACINES (Carotte, Oignon...) -> Jour RACINES + Lune Descendante.
   - Légumes FEUILLES (Salade, Chou...) -> Jour FEUILLES + Lune Montante.
   - FLEURS -> Jour FLEURS + Lune Montante.
3. SI LE JOUR N'EST PAS OPTIMAL : 
   - Détecte l'incompatibilité (ex: planter un fruit un jour Fleurs).
   - Cherche dans le "CALENDRIER DES 30 PROCHAINS JOURS" la date la plus proche qui réunit les conditions idéales (Phase + Zodiaque) pour ce type de plante.
   - Mentionne CLAIREMENT cette date recommandée dans le champ "moonWarning".
4. Génère des conseils de culture spécifiques au climat calédonien.
5. Calcule une date de récolte estimée réaliste.
6. Suggère une période de repiquage.

Réponds avec bienveillance et expertise en français.`,
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
