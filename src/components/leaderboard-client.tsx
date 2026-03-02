"use client";

import { Flash, Spinner, Text } from "@primer/react";
import { Stack } from "@primer/react/experimental";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardResponse } from "@/lib/types";

export function LeaderboardClient({ initialPage }: { initialPage: LeaderboardResponse }) {
  const [pages, setPages] = useState([initialPage]);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadNextPage = useEffectEvent(async () => {
    if (!nextCursor || isLoading || document.visibilityState === "hidden") {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leaderboard?cursor=${encodeURIComponent(nextCursor)}&limit=50`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Leaderboard request failed with ${response.status}`);
      }

      const payload = (await response.json()) as LeaderboardResponse;

      startTransition(() => {
        setPages((current) => [...current, payload]);
        setNextCursor(payload.nextCursor);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load the next page");
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    if (!sentinelRef.current || !nextCursor) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadNextPage();
          }
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextCursor]);

  const rows = pages.flatMap((page) => page.data);

  return (
    <Stack direction="vertical" gap="normal">
      {error && <Flash variant="danger">{error}</Flash>}
      <LeaderboardTable rows={rows} isLoadingMore={isLoading} />
      <div
        ref={sentinelRef}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--base-size-8)",
          padding: "var(--base-size-16)",
        }}
      >
        {nextCursor ? (
          isLoading ? (
            <>
              <Spinner size="small" />
              <Text size="small" weight="light">Loading more developers...</Text>
            </>
          ) : (
            <Text size="small" weight="light">Scroll to load more</Text>
          )
        ) : (
          <Text size="small" weight="light">End of leaderboard</Text>
        )}
      </div>
    </Stack>
  );
}
