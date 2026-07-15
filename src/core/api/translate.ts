import { useMutation } from '@tanstack/react-query';
import { authedPost, isBackendConfigured } from './backend';

// Free-text translation via the `translate` Cloud Function (Google Cloud
// Translation v2 on the project's own service account). The bundled
// phrasebook stays the offline layer; this powers the live translator card.

export interface Translation {
  translated: string;
  detectedSource?: string;
}

export async function translateText(
  text: string,
  target: string,
  source?: string,
): Promise<Translation> {
  return authedPost<Translation>('translate', { text, target, source });
}

export function useTranslateText() {
  return useMutation({
    mutationFn: ({ text, target, source }: { text: string; target: string; source?: string }) =>
      translateText(text, target, source),
  });
}

export const isTranslateAvailable = isBackendConfigured;
