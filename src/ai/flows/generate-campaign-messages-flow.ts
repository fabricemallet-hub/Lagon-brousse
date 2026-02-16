
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
      Ta mission est de rédiger des messages de campagne publicitaire pour les articles suivants :
      
      {{#each products}}
      - ARTICLE : {{title}}
      - TYPE : {{#if type}}{{type}}{{else}}Standard{{/if}}
      - INFOS : {{description}}
      - PRIX : {{#if price}}{{price}} FCFP{{else}}Non spécifié{{/if}}
      - REMISE : {{#if discount}}-{{discount}}%{{else}}AUCUNE REMISE (C'est un Arrivage/Nouveauté){{/if}}
      {{/each}}
      
      TON SOUHAITÉ : ${input.tone}
      LONGUEUR SOUHAITÉE : ${input.length} (Note: adapte la longueur réelle au canal).
      
      CONSIGNES CRITIQUES DE RÉDACTION :
      1. STRICTE FIDÉLITÉ : Ne parle QUE des produits listés ci-dessus. N'ajoute AUCUN autre article (pas de vêtements, pas de leurres si ils ne sont pas dans la liste).
      2. RESPECT DU TYPE : 
         - Si c'est un 'Nouvel Arrivage' sans remise : Ne parle JAMAIS de 'promo', 'remise', 'soldes' ou 'prix cassés'. Utilise des termes comme 'Exclusivité', 'Nouveauté', 'Enfin disponible'.
         - Si c'est une 'Promo' : Insiste sur l'économie réalisée et l'urgence.
      3. SMS : Max 160 caractères. Doit être direct et inclure le nom du magasin.
      4. PUSH : Max 80 caractères. Accrocheur et urgent.
      5. MAIL : Objet percutant + corps de texte structuré et vendeur.
      
      Pour chaque canal sélectionné dans [{{channels}}], génère EXACTEMENT 5 VARIANTES différentes.
      Utilise des expressions locales calédoniennes si le ton est 'Local (Caillou)'.`,
      output: { schema: GenerateCampaignOutputSchema }
    });
    return output!;
  }
);
