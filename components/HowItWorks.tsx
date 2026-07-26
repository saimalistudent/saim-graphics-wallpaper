import { FadeUp } from "@/components/FadeUp";

const steps = [
  { num: "01", title: "Browse", hint: "Open a catalog" },
  { num: "02", title: "Choose", hint: "Pick your design" },
  { num: "03", title: "WhatsApp", hint: "Send a screenshot" },
];

export function HowItWorks() {
  return (
    <section className="how-section" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <div className="how-header">
            <h2
              id="how-it-works-heading"
              className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-burgundy uppercase leading-[0.95]"
            >
              Easy Order
            </h2>
            <p className="how-sub">3 short steps</p>
          </div>
        </FadeUp>

        <FadeUp delay={0.08}>
          <ol className="how-rail">
            {steps.map((step, i) => (
              <li key={step.num} className="how-step">
                {i > 0 && <span className="how-connector" aria-hidden />}
                <span className="how-num" aria-hidden>
                  {step.num}
                </span>
                <h3 className="how-title">{step.title}</h3>
                <p className="how-hint">{step.hint}</p>
              </li>
            ))}
          </ol>
        </FadeUp>
      </div>
    </section>
  );
}
