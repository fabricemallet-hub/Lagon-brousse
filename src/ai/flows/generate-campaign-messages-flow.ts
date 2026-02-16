
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
      prompt: `Tu es un expert en marketing direct et communication digitale en Nouvelle-Calédonie pour le magasin ${input.businessName}.
      
      CONSIGNE ABSOLUE : Tu dois rédiger des messages de campagne basés EXCLUSIVEMENT et STRICTEMENT sur les informations des produits fournis ci-dessous. 
      INTERDICTION de mentionner des articles (vêtements, accessoires, articles de pêche génériques) qui ne figurent pas explicitement dans la liste fournie.
      
      ARTICLES À PROMOUVOIR (RELIRE ATTENTIVEMENT CHAQUE DESCRIPTION) :
      {{#each products}}
      - NOM DU PRODUIT : {{title}}
      - TYPE D'OFFRE : {{type}} (IMPORTANT : Si c'est 'Nouvel Arrivage', c'est une exclusivité, PAS une promotion)
      - DESCRIPTION COMMERCIALE (SOURCE DE TES ARGUMENTS) : {{description}}
      - PRIX : {{#if price}}{{price}} FCFP{{else}}Non spécifié{{/if}}
      - REMISE : {{#if discount}}-{{discount}}%{{else}}0% (AUCUNE REMISE - C'est une Nouveauté){{/if}}
      -------------------
      {{/each}}
      
      PARAMÈTRES DE RÉDACTION :
      - TON SOUHAITÉ : ${input.tone}
      - LONGUEUR : ${input.length} (Note : Adapte la densité d'information au canal de diffusion).
      
      RÈGLES DÉTAILLÉES PAR TYPE D'OFFRE :
      1. SI LE PRODUIT EST UN 'Nouvel Arrivage' : 
         - Ne JAMAIS utiliser les mots : 'promotion', 'solde', 'rabais', 'prix cassé', 'réduction', '%', 'moins cher'.
         - Utiliser un champ lexical de l'exclusivité et de l'arrivage : 'Nouveauté', 'Arrivage direct', 'Enfin disponible', 'Stock limité', 'Exclusivité', 'Venez découvrir'.
         - Se baser sur la DESCRIPTION COMMERCIALE pour mettre en avant la qualité, la technicité ou l'usage du produit spécifique.
      
      2. SI LE PRODUIT EST UNE 'Promo' :
         - Mettre en avant l'économie réalisée (le montant ou le %).
         - Créer un sentiment d'urgence et de bonne affaire.
      
      CONTRAINTES TECHNIQUES PAR CANAL :
      - SMS : Max 160 caractères. Ultra-direct. Doit inclure le nom du magasin.
      - PUSH : Max 80 caractères. Accrocheur, type notification mobile.
      - MAIL : Objet percutant + corps de texte structuré utilisant les détails précis de la DESCRIPTION pour convaincre.
      
      Pour chaque canal sélectionné [{{channels}}], génère EXACTEMENT 5 VARIANTES différentes.
      Si le ton est 'Local (Caillou)', utilise des expressions calédoniennes typiques (ex: 'Fin valable', 'Tata', 'Choc', 'C\'est pas des blagues', etc.) sans en abuser.`,
      output: { schema: GenerateCampaignOutputSchema }
    });
    return output!;
  }
);
