import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { HeroDownload } from "@/components/home/hero-download";
import { FEATURES_PATH, RECAP_IMAGE_BASE, RECAP_PATH } from "@/lib/links";

// A weekly recap card posted from lpm. The post's preview is the card itself;
// whoever clicks through lands here, on the card and a way to get lpm.

type Props = { params: Promise<{ id: string }> };

const ID = /^[A-Za-z0-9]{12}$/;
const TITLE = "A week of coding agents in lpm";
const DESCRIPTION =
  "Agent hours, prompts and pull requests from one developer's week in lpm, the free desktop app for running Claude Code, Codex and dev projects side by side.";

const imageOf = (id: string) => `${RECAP_IMAGE_BASE}/${id}.png`;

async function recapExists(id: string): Promise<boolean> {
  if (!ID.test(id)) return false;
  const response = await fetch(imageOf(id), { method: "HEAD", cache: "no-store" }).catch(() => null);
  return response?.ok ?? false;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const image = { url: imageOf(id), width: 1200, alt: "A week in lpm: agent hours, prompts, pull requests and lines changed" };
  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false, follow: true },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      type: "website",
      url: `${RECAP_PATH}/${id}`,
      siteName: "lpm",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: [image],
    },
  };
}

export default async function RecapPage({ params }: Props) {
  const { id } = await params;
  if (!(await recapExists(id))) notFound();
  return (
    <section className="pt-[clamp(6rem,14vh,9rem)] pb-20 text-center sm:pb-24">
      <div className="mx-auto max-w-2xl px-6">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
          Shared from lpm
        </p>
        <h1 className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-4xl font-extrabold leading-[1.1] tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-gray-100 dark:to-gray-400">
          A week of coding agents
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-gray-600 dark:text-gray-400">
          lpm runs Claude Code, Codex and your dev projects side by side, and every
          Monday sums up the week your agents put in.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- the card lives on the share relay */}
        <img
          src={imageOf(id)}
          alt="A week in lpm: agent hours, prompts, pull requests and lines changed"
          width={600}
          className="mx-auto mt-10 h-auto w-full max-w-[600px] rounded-2xl border border-gray-200 shadow-xl dark:border-gray-800"
        />
        <div className="mt-12 flex flex-col items-center gap-5">
          <HeroDownload source="recap" />
          <Link
            href={FEATURES_PATH}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            See everything lpm does
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
