'use server';

/**
 * @fileOverview A fishing success prediction AI agent.
 *
 * - fishingSuccessPrediction - A function that predicts fishing success.
 * - FishingSuccessInput - The input type for the fishingSuccessPrediction function.
 * - FishingSuccessOutput - The return type for the fishingSuccessPrediction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FishingSuccessInputSchema = z.object({
  tideCondition: z
    .string()
    .describe(
      'The tide condition (e.g., rising, falling, high, low). Provide specific details.'
    ),
  timeOfDay: z
    .string()
    .describe(
      'The time of day (e.g., dawn, morning, afternoon, dusk, night). Provide specific details.'
    ),
  lunarPhase: z
    .string()
    .describe(
      'The lunar phase (e.g., new moon, full moon, first quarter, third quarter). Provide specific details.'
    ),
});
export type FishingSuccessInput = z.infer<typeof FishingSuccessInputSchema>;

const FishingSuccessOutputSchema = z.object({
  successLikelihood: z
    .number()
    .describe(
      'The likelihood of a successful fishing trip, expressed as a percentage (0-100).'
    ),
  reasoning: z
    .string()
    .describe(
      'The reasoning behind the success likelihood prediction, based on the provided inputs.'
    ),
});
export type FishingSuccessOutput = z.infer<typeof FishingSuccessOutputSchema>;

export async function fishingSuccessPrediction(
  input: FishingSuccessInput
): Promise<FishingSuccessOutput> {
  return fishingSuccessPredictionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fishingSuccessPrompt',
  input: {schema: FishingSuccessInputSchema},
  output: {schema: FishingSuccessOutputSchema},
  prompt: `You are an expert fishing guide with years of experience predicting fishing success.

You will be provided with the tide condition, time of day, and lunar phase.
Based on these factors, you will predict the likelihood of a successful fishing trip as a percentage (0-100).
Also, explain the reasoning behind your prediction.

Tide Condition: {{{tideCondition}}}
Time of Day: {{{timeOfDay}}}
Lunar Phase: {{{lunarPhase}}}

Consider these rules:

- Rising tide is generally better for fishing.
- Dawn and dusk are prime fishing times.
- Full and new moons often lead to increased fish activity.
- A high likelihood should correlate with conditions where multiple favorable factors align.
`,
});

const fishingSuccessPredictionFlow = ai.defineFlow(
  {
    name: 'fishingSuccessPredictionFlow',
    inputSchema: FishingSuccessInputSchema,
    outputSchema: FishingSuccessOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
