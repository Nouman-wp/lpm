import { SectionHeader } from "@/components/section-header";
import { BeforeAfterClaim } from "./before-after-claim";
import { BeforeAfterCompare } from "./before-after-compare";
import { CompareDescription } from "./before-after-descriptions";
import { CountLine, WINDOW_COUNT } from "./before-after-legend";
import { LpmLayer, PileLayer } from "./before-after-stage";
import { StateLegend } from "./before-after-state-legend";
import { BeforeAfterSwitch } from "./before-after-switch";

const DESCRIPTION_ID = "before-after-description";

export function BeforeAfter() {
  return (
    <section className="relative overflow-x-clip py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          className="mb-6"
          eyebrow="Before / after"
          title="Stop hunting for the window that’s waiting on you"
        />
        <BeforeAfterClaim />
        <CompareDescription id={DESCRIPTION_ID} />
        <div data-state-scope className="hidden md:block">
          <BeforeAfterCompare
            before={<PileLayer layout="desk" />}
            after={<LpmLayer layout="desk" />}
            describedBy={DESCRIPTION_ID}
          />
          <div className="mt-4">
            <StateLegend />
          </div>
        </div>
        <div data-state-scope className="md:hidden">
          <BeforeAfterSwitch
            before={<PileLayer layout="phone" />}
            after={<LpmLayer layout="phone" />}
            windows={WINDOW_COUNT}
            counts={{ before: <CountLine side="before" />, after: <CountLine side="after" /> }}
          />
        </div>
      </div>
    </section>
  );
}
