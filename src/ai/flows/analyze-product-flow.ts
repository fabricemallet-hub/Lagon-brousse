
'use server';
/**
 * @fileOverview AI flow for analyzing product photos and generating commercial descriptions.
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
        
        TA MISSION :
        1. Regarde attentivement la ou les photos fournies.
        2. Rédige une DESCRIPTION COMMERCIALE percutante et attractive (env. 3-5 phrases).
           - Si c'est une PROMO : Insiste sur l'opportunité, le prix et l'urgence.
           - Si c'est une NOUVEAUTÉ : Insiste sur la qualité, l'innovation et l'exclusivité au pays.
        3. Propose 3 à 5 ARGUMENTS DE VENTE clés pour le vendeur.
        4. Donne un CONSEIL MARKETING spécifique pour mettre en avant ce produit dans le lagon ou la brousse (ex: "Mettez en avant la résistance au sel pour ce moulinet").
        
        Réponds en français avec un ton professionnel et enthousiaste.` },
        ...input.photos.map(url => ({ media: { url } }))
      ],
      output: { schema: AnalyzeProductOutputSchema }
    });
    return output!;
  }
);
