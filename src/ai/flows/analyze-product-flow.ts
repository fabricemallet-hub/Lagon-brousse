
'use server';
/**
 * @fileOverview AI flow for analyzing product photos and generating commercial descriptions with multiple options and tones.
 */

import { ai } from '@/ai/genkit';
import {
  AnalyzeProductInputSchema,
  AnalyzeProductOutputSchema,
  type AnalyzeProductInput,
  type AnalyzeProductOutput,
} from '@/ai/schemas';

export async function analyzeProduct(input: AnalyzeProductInput): Promise<AnalyzeProductOutput> {
  return analyzeProductFlow(input);
}

const analyzeProductFlow = ai.defineFlow(
  {
    name: 'analyzeProductFlow',
    inputSchema: AnalyzeProductInputSchema,
    outputSchema: AnalyzeProductOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: [
        { text: `Tu es un expert en marketing et vente au détail en Nouvelle-Calédonie. 
        Analyse ce produit pour un magasin de ${input.category}.
        
        PRODUIT : ${input.title}
        TYPE : ${input.type}
        ${input.price ? `PRIX : ${input.price} FCFP` : ''}
        ${input.discountPercentage ? `REMISE : -${input.discountPercentage}%` : ''}
        ${input.additionalInfo ? `INFOS COMPLÉMENTAIRES DU VENDEUR : ${input.additionalInfo}` : ''}
        TON SOUHAITÉ : ${input.tone || 'Commercial'}
        
        TA MISSION :
        1. Regarde attentivement la ou les photos fournies.
        2. Rédige 3 VARIANTES de DESCRIPTION COMMERCIALE (env. 3-5 phrases par variante) en respectant STRICTEMENT le TON SOUHAITÉ.
           - SI LE TON EST 'Local (Caillou)' : Utilise des expressions locales calédoniennes sans en faire trop, parle au coeur des gens du pays.
           - SI C'EST UNE PROMO : Insiste lourdement sur l'économie réalisée, la rareté et l'urgence.
           - SI C'EST UNE NOUVEAUTÉ : Insiste sur l'exclusivité et la qualité.
        3. Propose 3 à 5 ARGUMENTS DE VENTE clés centrés sur le bénéfice client.
        4. Donne un CONSEIL MARKETING spécifique pour le Caillou.
        
        Réponds en français. Le champ 'commercialDescriptions' doit contenir exactement 3 textes distincts.` },
        ...input.photos.map(url => ({ media: { url } }))
      ],
      output: { schema: AnalyzeProductOutputSchema }
    });
    return output!;
  }
);
