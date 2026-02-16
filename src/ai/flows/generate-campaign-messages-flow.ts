
'use server';
/**
 * @fileOverview AI flow for generating campaign messages for multiple channels.
 */

import { ai } from '@/ai/genkit';
import {
  GenerateCampaignInputSchema,
  GenerateCampaignOutputSchema,
  type GenerateCampaignInput,
  type GenerateCampaignOutput,
} from '@/ai/schemas';

export async function generateCampaignMessages(input: GenerateCampaignInput): Promise<GenerateCampaignOutput> {
  return generateCampaignMessagesFlow(input);
}

const generateCampaignMessagesFlow = ai.defineFlow(
  {
    name: 'generateCampaignMessagesFlow',
    inputSchema: GenerateCampaignInputSchema,
    outputSchema: GenerateCampaignOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Tu es un expert en marketing direct en Nouvelle-Calédonie pour le magasin ${input.businessName}.
      Ta mission est de rédiger des messages de campagne pour les articles suivants :
      
      {{#each products}}
      - {{title}} : {{description}} {{#if price}}({{price}} F){{/if}} {{#if discount}}-{{discount}}%{{/if}}
      {{/each}}
      
      TON SOUHAITÉ : ${input.tone}
      LONGUEUR SOUHAITÉE : ${input.length} (Note: adapte la longueur réelle au canal).
      
      CONSIGNES PAR CANAL :
      1. SMS : Ultra-court, urgent, max 160 caractères. Doit inclure le nom du magasin et l'offre phare.
      2. PUSH : Accrocheur, court, max 100 caractères.
      3. MAIL : Plus détaillé, avec un objet captivant.
      
      Pour chaque canal sélectionné dans [{{channels}}], génère EXACTEMENT 5 VARIANTES différentes.
      Utilise des expressions locales si le ton est 'Local'.`,
      output: { schema: GenerateCampaignOutputSchema }
    });
    return output!;
  }
);
