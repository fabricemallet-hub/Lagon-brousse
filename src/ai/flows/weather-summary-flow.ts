'use server';
/**
 * @fileOverview AI flow for generating a 7-day weather summary and advice.
 *
 * - getWeatherSummary - A function that analyzes weather trends.
 */

import { ai } from '@/ai/genkit';
import {
  WeatherSummaryInputSchema,
  WeatherSummaryOutputSchema,
  type WeatherSummaryInput,
  type WeatherSummaryOutput,
} from '@/ai/schemas';

export async function getWeatherSummary(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return weatherSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'weatherSummaryPrompt',
  input: { schema: WeatherSummaryInputSchema },
  output: { schema: WeatherSummaryOutputSchema },
  prompt: `Tu es un expert météo en Nouvelle-Calédonie. Analyse les prévisions sur 7 jours pour la commune de {{{commune}}} :

{{#each forecasts}}
- {{{date}}} : {{{condition}}}, {{{tempMin}}}°C à {{{tempMax}}}°C, Vent max {{{windSpeed}}} ND de {{{windDirection}}}, UV max {{{uvIndex}}}.
{{/each}}

TA MISSION :
1. Rédige un bilan global de l'évolution du temps sur la semaine (tendance des températures, calme ou venté, humidité).
2. Donne des conseils spécifiques aux activités locales : est-ce une bonne semaine pour la pêche (vent), la chasse ou le jardinage (pluie/chaleur) ?
3. Liste les précautions de sécurité indispensables (protection solaire basée sur l'UV max fourni pour chaque journée, navigation si vent fort). Ignore les UV minimaux nocturnes, concentre-toi sur le pic UV maximal de la journée.

Réponds avec expertise et clarté en français.`,
});

const weatherSummaryFlow = ai.defineFlow(
  {
    name: 'weatherSummaryFlow',
    inputSchema: WeatherSummaryInputSchema,
    outputSchema: WeatherSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
