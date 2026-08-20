'use client';

import { useCallback, useState } from 'react';
import type { Answer } from '@/lib/types';

export interface AskState {
  question: string;
  setQuestion: (value: string) => void;
  answer: Answer | null;
  /** The question the current answer belongs to, so the panel can show it
   *  above the response after the input has been cleared or edited. */
  asked: string | null;
  pending: boolean;
  error: string | null;
  ask: () => void;
  clear: () => void;
}

/** Semantic question over everything ingested, as opposed to the board's
 *  filter, which only narrows the rows already on screen. */
export function useAsk(): AskState {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setPending(true);
    setError(null);
    setAnswer(null);
    setAsked(trimmed);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo responder.');
      setAnswer({ answer: data.answer, sources: data.sources ?? [] });
    } catch (err) {
      // Shown, not swallowed: a blank panel would read as "nothing found".
      setError(err instanceof Error ? err.message : 'No se pudo responder.');
    } finally {
      setPending(false);
    }
  }, [question, pending]);

  const clear = useCallback(() => {
    setQuestion('');
    setAsked(null);
    setAnswer(null);
    setError(null);
  }, []);

  return { question, setQuestion, answer, asked, pending, error, ask, clear };
}
