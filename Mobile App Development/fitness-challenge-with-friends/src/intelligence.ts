import { useCallback, useEffect, useRef, useState } from 'react';
import { availability, consequenceIdeas, recap } from '../modules/rally-intelligence';
import type { ChallengeDetail } from '../shared/api';
import { CONSEQUENCE_SUGGESTIONS, offLimitsReason } from '../shared/copy';

// Apple Intelligence runs on the phone itself, so nothing here touches the server. Every use is an
// extra: when the model is missing (older iPhones, Apple Intelligence off, web, Expo Go) or a request
// fails, the screen is exactly what it was before.

export const hasAppleIntelligence = (): boolean => availability() === 'available';

/** The standings, in words the model can retell without doing any maths of its own. */
export function recapFacts(d: ChallengeDetail): string {
  const lines = [`Challenge: ${d.name}, ${d.targetText}.`];
  lines.push(d.status === 'done' ? `It is over. ${d.resultText ?? ''}`.trim() : `Time: ${d.daysLeftText}.`);
  for (const s of d.standings) {
    const who = s.isYou ? `${s.name} (this is you)` : s.name;
    const move = s.delta ? `, ${s.delta.startsWith('-') ? 'down' : 'up'} ${s.delta.replace(/^[-+]/, '')} places this week` : '';
    const hook = s.onTheHook ? ', currently in last place and on the hook for the consequence' : '';
    lines.push(`Place ${s.rank}: ${who}, ${s.label} done (${s.percent}%)${move}${hook}.`);
  }
  if (d.consequence?.status === 'agreed' && d.consequence.text) lines.push(`Whoever finishes last: ${d.consequence.text}.`);
  return lines.join('\n');
}

// One recap per set of facts for as long as the app is open: coming back to a challenge whose
// standings have not moved shows the same words instantly instead of writing new ones.
const recaps = new Map<string, Promise<string | null>>();

/** A sentence or two about where you stand, or null while writing, without the model, or on failure. */
export function useRecap(detail: ChallengeDetail): string | null {
  const wanted = hasAppleIntelligence() && detail.status !== 'waiting' && detail.standings.length >= 2;
  const facts = wanted ? recapFacts(detail) : null;
  const [text, setText] = useState<{ facts: string; text: string } | null>(null);

  useEffect(() => {
    if (!facts) return;
    let live = true;
    if (!recaps.has(facts)) {
      recaps.set(
        facts,
        recap(facts).then(
          (t) => t || null,
          () => {
            recaps.delete(facts); // a guardrail refusal or a busy model: try again next visit
            return null;
          },
        ),
      );
    }
    recaps.get(facts)!.then((t) => {
      if (live && t) setText({ facts, text: t });
    });
    return () => {
      live = false;
    };
  }, [facts]);

  return text && text.facts === facts ? text.text : null;
}

/**
 * Fresh consequence ideas from the model, filtered through the same no-money rule as anything typed.
 * `ideas` is empty until asked. Each ask replaces the last set.
 */
export function useConsequenceIdeas(context: string) {
  const [ideas, setIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const seen = useRef(new Set(CONSEQUENCE_SUGGESTIONS.map((s) => s.toLowerCase())));

  const ask = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const fresh = (await consequenceIdeas(context))
        .map((s) => s.trim().replace(/[.!]+$/, ''))
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .filter((s) => s.length > 2 && s.length <= 80 && !offLimitsReason(s) && !seen.current.has(s.toLowerCase()));
      fresh.forEach((s) => seen.current.add(s.toLowerCase()));
      if (fresh.length) setIdeas(fresh);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [context]);

  return { available: hasAppleIntelligence(), ideas, busy, failed, ask };
}
