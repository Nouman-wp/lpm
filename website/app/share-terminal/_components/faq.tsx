import { ChevronDown } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { jsonLdString } from "@/lib/structured-data";

type QA = {
  question: string;
  answer: string;
};

const FAQS: QA[] = [
  {
    question: "Can I share my terminal with someone else?",
    answer:
      "Yes. In lpm, right-click a terminal tab, choose Share tab, click Create invite and send the link. The other person opens it, asks to join, and once you click Let in they see the tab live, exactly as it looks on your screen. They can only watch until you switch Guests to Can type.",
  },
  {
    question: "Can I share a Claude Code or Codex session?",
    answer:
      "Yes, the same way: share the tab the agent runs in. Guests watch it think, answer and edit as it happens, and with Can type they can send it prompts too. Anything they type goes into your session, so it runs on your login and counts against your usage, the same as if you had typed it.",
  },
  {
    question: "Does the other person need lpm or an account?",
    answer:
      "No. A browser is enough, on a computer or a phone. They don't sign in to anything; they type their name so you know who is asking. If they do use lpm, the same link opens it instead.",
  },
  {
    question: "Can anyone with the link get in? How secure is it?",
    answer:
      "The link alone gets nobody in. Every person asks to join under a name, and lpm shows you the request with Let in and Deny. Browser guests also see four emoji that match the ones on your screen, so you can ask which ones they see before letting them in. A browser connection is encrypted end to end between their browser and your computer: lpm's relay passes it along and can't read it. Teammates who join from lpm connect straight to your computer, encrypted and pinned to it.",
  },
  {
    question: "What can a guest do on my computer?",
    answer:
      "With View only, the default, they can read the tab, scroll back and copy text. With Can type, they can type into that one tab, which means a command typed there runs as you, like a colleague at your keyboard. They can't open your other tabs, projects or files, resize your terminal or take over your view. Switch back to View only, or Remove them, at any time.",
  },
  {
    question: "Which tabs can I share?",
    answer:
      "Any terminal tab: a plain shell, a long build, Claude Code, Codex or Gemini CLI. Tabs that show a project's services, like a dev server's output, can't be shared, and neither can a tab that runs on another computer you're connected to.",
  },
  {
    question: "Do we need to be on the same network?",
    answer:
      "Not for a browser: it joins from anywhere, with no ports to open on your router. A teammate who opens the link in lpm connects directly to your computer, so they need to reach it on the same network or over Tailscale.",
  },
  {
    question: "Can several people join the same tab?",
    answer:
      "Yes. One link works for everyone you send it to, and each person asks to join and is let in separately. Up to three people can wait for your answer at once, and a request you don't answer lapses after two minutes. Can type applies to everyone in the tab, and Remove takes out one person.",
  },
  {
    question: "What do guests see when they join?",
    answer:
      "Your tab at your size, starting with what it already holds, then everything live. A browser fits it to the window by shrinking the text, so nothing on your side changes size. The browser gets a prompt box and Esc, arrow, Tab, Return and Ctrl C keys, and they work only while typing is on.",
  },
  {
    question: "How do I stop sharing?",
    answer:
      "Right-click the tab, choose Share tab and click Stop sharing: everyone's view ends right away. Remove ends one person's view, and quitting lpm ends every share. A guest can click Leave at any time. A short network drop doesn't end anything; the browser reconnects by itself.",
  },
  {
    question: "Is it free?",
    answer:
      "Yes. lpm is free and open source, and sharing a tab, including joining from a browser, is part of it. There's no account to create on either side.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default function Faq() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader
          eyebrow="FAQ"
          title="Sharing a terminal: what people ask"
        />
        <ul className="space-y-3">
          {FAQS.map(({ question, answer }) => (
            <li key={question}>
              <details className="group rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors duration-200 open:border-gray-300 dark:open:border-gray-700 open:bg-gray-50/50 dark:open:bg-white/[0.02]">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
                  <span>{question}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {answer}
                </div>
              </details>
            </li>
          ))}
        </ul>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
        />
      </div>
    </section>
  );
}
