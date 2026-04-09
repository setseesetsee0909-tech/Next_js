"use server";

import { revalidatePath } from "next/cache";
import { createRegistration } from "@/lib/registrations";
import type { SubmissionState } from "@/lib/types";
import {
  parseRegistrationFormData,
  validateRegistrationInput,
} from "@/lib/validation";

const DEMO_DELAY_MS = 1200;

export async function registerTournamentParticipant(
  _previousState: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  const input = parseRegistrationFormData(formData);
  const validationError = validateRegistrationInput(input);

  if (validationError) {
    return validationError;
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
    const registration = await createRegistration(input);

    revalidatePath("/");
    revalidatePath("/dashboard");

    return {
      status: "success",
      message: "Registration saved. The dashboard will reflect it immediately.",
      registration,
    };
  } catch {
    return {
      status: "error",
      message: "Saving failed. Your optimistic preview was rolled back safely.",
    };
  }
}
