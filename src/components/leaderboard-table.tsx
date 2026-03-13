import { ArrowUpRightIcon } from "@primer/octicons-react";
import { Avatar, Link as PrimerLink, Text } from "@primer/react";
import { DataTable, Stack } from "@primer/react/experimental";
import type { Column } from "@primer/react/experimental";

import type { LeaderboardEntry } from "@/lib/types";

type LeaderboardRow = LeaderboardEntry & { id: number };

function formatShortDate(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeTimestamp(value: string | null) {
  if (!value) {
    return "Queued";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LeaderboardTable({
  rows,
  isLoadingMore = false,
}: {
  rows: LeaderboardEntry[];
  isLoadingMore?: boolean;
}) {
  const dataWithIds: LeaderboardRow[] = rows.map((row) => ({
    ...row,
    id: row.githubId,
  }));

  const columns: Column<LeaderboardRow>[] = [
    {
      header: "Rank",
      field: "rank",
      width: "auto",
      renderCell: (row) => (
        <Text weight="semibold">#{row.rank}</Text>
      ),
    },
    {
      header: "Developer",
      field: "login",
      rowHeader: true,
      renderCell: (row) => (
        <PrimerLink href={`/u/${row.login}`} style={{ textDecoration: "none", color: "inherit" }}>
          <Stack direction="horizontal" gap="condensed" align="center">
            <Avatar src={row.avatarUrl} alt={`${row.login} avatar`} size={32} />
            <Stack direction="vertical" gap="none">
              <Text weight="semibold">{row.name ?? row.login}</Text>
              <Text size="small" weight="light">@{row.login}</Text>
            </Stack>
          </Stack>
        </PrimerLink>
      ),
    },
    {
      header: "Created",
      field: "githubCreatedAt",
      renderCell: (row) => <Text size="small">{formatShortDate(row.githubCreatedAt)}</Text>,
    },
    {
      header: "All-time commits",
      field: "allTimeCommits",
      renderCell: (row) => (
        <Text weight="semibold">
          {row.allTimeCommits.toLocaleString()}
        </Text>
      ),
    },
    {
      header: "Last updated",
      field: "lastUpdatedAt",
      renderCell: (row) => (
        <Text size="small" weight="light">{formatRelativeTimestamp(row.lastUpdatedAt)}</Text>
      ),
    },
    {
      header: "Profile",
      field: "profileUrl",
      renderCell: (row) => (
        <PrimerLink href={row.profileUrl} target="_blank" rel="noreferrer">
          GitHub <ArrowUpRightIcon size={12} />
        </PrimerLink>
      ),
    },
  ];

  return (
    <Stack direction="vertical" gap="condensed">
      <DataTable
        aria-label="GitHub commits leaderboard"
        data={dataWithIds}
        columns={columns}
        cellPadding="spacious"
      />
      {isLoadingMore && (
        <Stack direction="horizontal" gap="condensed" align="center" justify="center" padding="normal">
          <Text size="small" weight="light">Loading more developers...</Text>
        </Stack>
      )}
    </Stack>
  );
}
