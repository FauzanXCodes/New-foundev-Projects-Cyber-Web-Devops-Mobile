import { requireOptionalNativeModule } from 'expo';

type Availability = 'available' | 'deviceNotEligible' | 'notEnabled' | 'modelNotReady' | 'unsupported';

type RallyIntelligenceModule = {
  availability(): Availability;
  recap(facts: string): Promise<string>;
  consequenceIdeas(context: string): Promise<string[]>;
};

// Missing on web, in Expo Go and in builds made before this module existed: all of those act as
// a phone without Apple Intelligence.
const native = requireOptionalNativeModule<RallyIntelligenceModule>('RallyIntelligence');

export function availability(): Availability {
  try {
    return native?.availability() ?? 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export const recap = (facts: string): Promise<string> =>
  native ? native.recap(facts) : Promise.reject(new Error('Apple Intelligence is not available'));

export const consequenceIdeas = (context: string): Promise<string[]> =>
  native ? native.consequenceIdeas(context) : Promise.reject(new Error('Apple Intelligence is not available'));
