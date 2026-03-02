"use client";

import { ShieldCheckIcon, OrganizationIcon, GitCommitIcon } from "@primer/octicons-react";
import { Button, Checkbox, FormControl, Heading, Link as PrimerLink, PageLayout, Text } from "@primer/react";
import { Stack } from "@primer/react/experimental";
import { useState } from "react";

export default function ConnectPage() {
  const [agreed, setAgreed] = useState(false);

  return (
    <PageLayout containerWidth="medium" padding="normal">
      <PageLayout.Content>
        <Stack direction="vertical" gap="spacious" padding="spacious" align="center">
          <PrimerLink href="/">← Back to leaderboard</PrimerLink>

          <Stack direction="vertical" gap="normal" align="center">
            <Heading as="h1" style={{ textAlign: "center" }}>Connect Your GitHub Account</Heading>
            <Text size="medium" style={{ textAlign: "center", maxWidth: "500px" }}>
              To accurately count your all-time commits, we need access to your contribution data
              across all organizations you belong to.
            </Text>
          </Stack>

          <Stack
            direction="vertical"
            gap="normal"
            style={{
              padding: "var(--base-size-24)",
              border: "var(--borderWidth-thin) solid var(--borderColor-default)",
              borderRadius: "var(--borderRadius-medium)",
              backgroundColor: "var(--bgColor-muted)",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <Heading as="h2" style={{ fontSize: "var(--text-title-size-medium)" }}>
              Important: Grant Organization Access
            </Heading>

            <Stack direction="horizontal" gap="condensed" align="start">
              <span style={{ color: "var(--fgColor-accent)", flexShrink: 0, marginTop: 2 }}>
                <OrganizationIcon size={20} />
              </span>
              <Text size="small">
                On the GitHub authorization screen, you&apos;ll see a list of organizations.
                <strong> Click &quot;Grant&quot; next to each organization</strong> you want commits counted from.
              </Text>
            </Stack>

            <Stack direction="horizontal" gap="condensed" align="start">
              <span style={{ color: "var(--fgColor-accent)", flexShrink: 0, marginTop: 2 }}>
                <GitCommitIcon size={20} />
              </span>
              <Text size="small">
                If you skip granting access to an organization, commits you made to repositories
                in that org <strong>will not be included</strong> in your total.
              </Text>
            </Stack>

            <Stack direction="horizontal" gap="condensed" align="start">
              <span style={{ color: "var(--fgColor-success)", flexShrink: 0, marginTop: 2 }}>
                <ShieldCheckIcon size={20} />
              </span>
              <Text size="small">
                <strong>Read-only access:</strong> We only request permission to read your profile
                and contribution counts. We cannot modify your repositories, create commits,
                or access your code.
              </Text>
            </Stack>
          </Stack>

          <FormControl>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <FormControl.Label>
              I agree that this application will read my commit data (public and private)
              and that anonymized information may be used in research projects
            </FormControl.Label>
          </FormControl>

          <Stack direction="vertical" gap="condensed" align="center">
            <Button
              as={agreed ? "a" : "button"}
              href={agreed ? "/login" : undefined}
              variant="primary"
              size="large"
              disabled={!agreed}
            >
              Continue to GitHub Authorization
            </Button>
            <Text size="small" style={{ color: "var(--fgColor-muted)" }}>
              You&apos;ll be redirected to GitHub to authorize
            </Text>
          </Stack>
        </Stack>
      </PageLayout.Content>
    </PageLayout>
  );
}
