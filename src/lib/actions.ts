'use server';

import {
  fishingSuccessPrediction,
  type FishingSuccessInput,
  type FishingSuccessOutput,
} from '@/ai/flows/fishing-success-prediction';
import { z } from 'zod';

const formSchema = z.object({
  tideCondition: z.string().min(1, 'La condition de marée est requise.'),
  timeOfDay: z.string().min(1, "L'heure de la journée est requise."),
  lunarPhase: z.string().min(1, 'La phase lunaire est requise.'),
});

export type PredictionState = {
  data: FishingSuccessOutput | null;
  error: string | null;
};

export async function getFishingPrediction(
  prevState: PredictionState,
  formData: FormData
): Promise<PredictionState> {
  try {
    const validatedFields = formSchema.safeParse(
      Object.fromEntries(formData.entries())
    );

    if (!validatedFields.success) {
      return {
        data: null,
        error: 'Veuillez remplir tous les champs.',
      };
    }
    
    const input: FishingSuccessInput = validatedFields.data;
    const prediction = await fishingSuccessPrediction(input);

    return { data: prediction, error: null };
  } catch (error) {
    console.error(error);
    return {
      data: null,
      error: 'Une erreur est survenue lors de la prédiction. Veuillez réessayer.',
    };
  }
}
