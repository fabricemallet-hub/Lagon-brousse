'use server';
/**
 * @fileOverview AI flow for suggesting plants based on the current month in New Caledonia.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export async function getGardenSuggestions(month: string) {
  const { output } = await ai.generate({
    prompt: `Tu es un expert jardinier en Nouvelle-Calédonie. Nous sommes au mois de ${month}. 
    Suggère 6 plantes (arbres fruitiers, fleurs, potager ou aromatiques) populaires et adaptées au climat local pour un suivi de jardin en ce moment.
    Réponds uniquement au format JSON avec une liste de suggestions contenant 'name' et 'category'.
    Les catégories autorisées sont exclusivement : "Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre".`,
    output: {
      schema: z.object({
        suggestions: z.array(z.object({
          name: z.string().describe("Nom commun de la plante"),
          category: z.enum(["Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre"]).describe("Catégorie de la plante")
        }))
      })
    }
  });
  return output?.suggestions || [];
}
