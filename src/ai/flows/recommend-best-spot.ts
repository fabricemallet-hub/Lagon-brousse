'use server';
/**
 * @fileOverview AI flow for recommending the best fishing spot among saved spots based on current conditions and user location.
 */

import { ai } from '@/ai/genkit';
import { RecommendBestSpotInputSchema, RecommendBestSpotOutputSchema, type RecommendBestSpotInput, type RecommendBestSpotOutput } from '@/ai/schemas';

export async function recommendBestSpot(input: RecommendBestSpotInput): Promise<RecommendBestSpotOutput> {
  return recommendBestSpotFlow(input);
}

const recommendBestSpotPrompt = ai.definePrompt({
  name: 'recommendBestSpotPrompt',
  input: { schema: RecommendBestSpotInputSchema },
  output: { schema: RecommendBestSpotOutputSchema },
  prompt: `Tu es un expert en pêche traditionnelle en Nouvelle-Calédonie. L'utilisateur veut savoir lequel de ses coins de pêche habituels est le plus approprié **MAINTENANT**, en fonction des conditions actuelles et de sa position GPS.

CONTEXTE ACTUEL À {{{location}}} :
- Marée : Mouvement {{{currentContext.tideMovement}}}, Hauteur {{{currentContext.tideHeight}}}m, Courant {{{currentContext.tideCurrent}}}
- Lune : {{{currentContext.moonPhase}}}

COINS DE PÊCHE CANDIDATS (Spots enregistrés par l'utilisateur) :
{{#each candidateSpots}}
- Spot : {{{name}}} (ID: {{{id}}})
  - Distance de l'utilisateur : {{{distance}}} mètres
  - Historique de réussite (conditions lors de l'enregistrement) : Marée {{{historicalContext.tideMovement}}}, Lune {{{historicalContext.moonPhase}}}
{{/each}}

TA MISSION :
1. Analyse chaque spot. Compare ses conditions de réussite passées avec le contexte actuel (Marée/Lune).
2. Priorise les spots dont les conditions de marée (montante/descendante/étale) et de lune correspondent au succès passé de l'utilisateur.
3. Prends en compte la distance : un spot très proche peut être recommandé même si le contexte n'est pas "parfait", pour une sortie rapide.
4. Recommande le **MEILLEUR** spot pour une sortie immédiate.
5. Dans "reason", explique ton choix de manière concise (ex: "La marée descendante actuelle correspond parfaitement à votre grosse prise sur ce spot, et il n'est qu'à 1500m de vous.").
6. Dans "advice", donne un conseil tactique spécifique au Caillou (ex: "Cherchez les bordures de récif avec un leurre souple coloré").

RÉPONDS UNIQUEMENT AU FORMAT JSON.`,
});

const recommendBestSpotFlow = ai.defineFlow(
  {
    name: 'recommendBestSpotFlow',
    inputSchema: RecommendBestSpotInputSchema,
    outputSchema: RecommendBestSpotOutputSchema,
  },
  async (input) => {
    const { output } = await recommendBestSpotPrompt(input);
    return output!;
  }
);
