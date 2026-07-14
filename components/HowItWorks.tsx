import { FadeUp } from "@/components/FadeUp";

const steps = [
  { num: "01", title: "Browse", hint: "Catalogs kholo" },
  { num: "02", title: "Choose", hint: "Design pasand karo" },
  { num: "03", title: "WhatsApp", hint: "Screenshot bhejo" },
];

export function HowItWorks() {
  return (
    <section className="how-section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <div className="how-header">
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-burgundy uppercase leading-[0.95]">
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
                <span className="how-num">{step.num}</span>
                <span className="how-title">{step.title}</span>
                <span className="how-hint">{step.hint}</span>
              </li>
            ))}
          </ol>
        </FadeUp>
      </div>
    </section>
  );
}
