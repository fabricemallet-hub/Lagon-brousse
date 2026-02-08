
'use server';
/**
 * @fileOverview AI flow for generating structured information about fish species in New Caledonia.
 * Used in the admin panel to auto-fill fish records.
 */

import { ai } from '@/ai/genkit';
import {
  GenerateFishInfoInputSchema,
  GenerateFishInfoOutputSchema,
  type GenerateFishInfoInput,
  type GenerateFishInfoOutput,
} from '@/ai/schemas';

export async function generateFishInfo(input: GenerateFishInfoInput): Promise<GenerateFishInfoOutput> {
  return generateFishInfoFlow(input);
}

const generateFishInfoPrompt = ai.definePrompt({
  name: 'generateFishInfoPrompt',
  input: { schema: GenerateFishInfoInputSchema },
  output: { schema: GenerateFishInfoOutputSchema },
  prompt: `Tu es un expert en biologie marine et en pêche traditionnelle en Nouvelle-Calédonie.
Ta mission est de fournir des informations techniques précises pour le poisson suivant :

NOM COMMUN : {{{name}}}
{{#if scientificName}}NOM SCIENTIFIQUE FOURNI : {{{scientificName}}}{{/if}}

Règles à suivre :
1. Identifie le nom scientifique exact. {{#if scientificName}}IMPORTANT : Si un NOM SCIENTIFIQUE FOURNI est présent, utilise-le comme identifiant unique et prioritaire pour garantir que toutes les données retournées concernent précisément ce spécimen. Ne le change pas dans ta réponse sauf s'il s'agit d'une erreur manifeste.{{/if}}
2. Évalue le risque de "gratte" (ciguatera) spécifiquement dans les lagons calédoniens pour trois tailles :
   - Petit spécimen (inférieur à la taille de maturité habituelle)
   - Moyen spécimen (taille standard de capture)
   - Grand spécimen (vieux géniteur, souvent très accumulé en toxines)
   Donne ces taux en pourcentage (0-100).
3. Détermine les tranches de longueurs réalistes en CM pour chaque catégorie (Petit, Moyen, Grand) pour cette espèce précise en Nouvelle-Calédonie.
   Format attendu pour les longueurs : '< 30cm', '30-60cm', '> 60cm'.
4. Détermine si c'est un poisson de "Lagon", du "Large" ou de "Recif".
5. Rédige des conseils culinaires adaptés aux habitudes locales (ex: salade tahitienne, bougna, grillade).
6. Fournis des conseils de pêche précis pour le Caillou (type d'appât, profondeur, zone).

Réponds en français avec expertise.`,
});

const generateFishInfoFlow = ai.defineFlow(
  {
    name: 'generateFishInfoFlow',
    inputSchema: GenerateFishInfoInputSchema,
    outputSchema: GenerateFishInfoOutputSchema,
  },
  async (input) => {
    const { output } = await generateFishInfoPrompt(input);
    return output!;
  }
);
