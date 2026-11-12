"use client";

import { useEffect, useState } from "react";
import { getLastRegisteredRepository, type RegisteredRepository } from "@/lib/api";

export interface LastRegisteredRepositoryState {
  repository: RegisteredRepository | null;
  loading: boolean;
  error: string | null;
}

export function useLastRegisteredRepository(): LastRegisteredRepositoryState {
  const [repository, setRepository] = useState<RegisteredRepository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await getLastRegisteredRepository();
        if (active) {
          setRepository(response.repository);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The registered repository could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return { repository, loading, error };
}
