'use client';

import useSWR from 'swr';
import { casesApi, type ApiCase, type CaseFilters, ApiError } from '../lib/api';

/* ── SWR fetcher ──────────────────────────────────────────── */
function buildKey(filters?: CaseFilters): string {
  const base = '/api/cases';
  if (!filters) return base;
  const parts: string[] = [];
  if (filters.barangay_id) parts.push(`b=${filters.barangay_id}`);
  if (filters.type)        parts.push(`t=${filters.type}`);
  if (filters.gender)      parts.push(`g=${filters.gender}`);
  return parts.length ? `${base}?${parts.join('&')}` : base;
}

/* ── useCases ─────────────────────────────────────────────── */
export interface UseCasesResult {
  cases:     ApiCase[];
  isLoading: boolean;
  isError:   boolean;
  error:     ApiError | Error | null;
  mutate:    () => void;
}

export function useCases(filters?: CaseFilters): UseCasesResult {
  const key = buildKey(filters);

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => casesApi.getPublic(filters).then(r => r.cases),
    {
      revalidateOnFocus:     false,
      revalidateOnReconnect: true,
      dedupingInterval:      60_000,   // 60 seconds
      keepPreviousData:      true,     // show stale data while revalidating
      errorRetryCount:       3,
      errorRetryInterval:    5_000,
    }
  );

  return {
    cases:     data ?? [],
    isLoading: isLoading && !data,  // only true on first load (no cached data)
    isError:   !!error,
    error:     error ?? null,
    mutate,
  };
}

/* ── usePendingCases (admin) ──────────────────────────────── */
export function usePendingCases() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/cases/admin/pending',
    () => casesApi.getPending().then(r => r.cases),
    {
      revalidateOnFocus: true,
      dedupingInterval:  15_000,
    }
  );

  return {
    cases:     data ?? [],
    isLoading: isLoading && !data,
    isError:   !!error,
    error:     error ?? null,
    mutate,
  };
}

/* ── useBarangays ─────────────────────────────────────────── */
export function useBarangays() {
  const { data, error, isLoading } = useSWR(
    '/api/cases/barangays',
    () => casesApi.getBarangays().then(r => r.barangays),
    {
      revalidateOnFocus: false,
      dedupingInterval:  60 * 60 * 1000,  // 1 hour — barangays never change
    }
  );

  return {
    barangays: data ?? [],
    isLoading: isLoading && !data,
    isError:   !!error,
  };
}
