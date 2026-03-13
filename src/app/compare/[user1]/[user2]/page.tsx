import type { Metadata } from "next";

import { findUserByLoginWithCount } from "@/lib/db";
import { siteUrl, siteName } from "@/app/seo";
import { CompareContent } from "./compare-content";

type Props = {
  params: Promise<{ user1: string; user2: string }>;
};

async function lookupUser(login: string) {
  const result = await findUserByLoginWithCount(login);
  if (!result.found || !result.data) return null;
  const percentile = Math.max(
    1,
    Math.ceil((1 - (result.data.rank - 1) / result.totalUsers) * 100),
  );
  return { ...result.data, percentile };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user1, user2 } = await params;
  const [a, b] = await Promise.all([lookupUser(user1), lookupUser(user2)]);

  if (!a || !b) {
    return { title: `Compare | ${siteName}` };
  }

  const nameA = a.name ?? a.login;
  const nameB = b.name ?? b.login;
  const title = `${nameA} vs ${nameB} | ${siteName}`;
  const description = `${nameA} (#${a.rank}) vs ${nameB} (#${b.rank}) — compare GitHub commit rankings head to head.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/compare/${a.login}/${b.login}`,
      siteName,
      type: "website",
    },
  };
}

export default async function ComparePage({ params }: Props) {
  const { user1, user2 } = await params;
  const [a, b] = await Promise.all([lookupUser(user1), lookupUser(user2)]);

  return <CompareContent userA={a} userB={b} siteUrl={siteUrl} />;
}
