"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePageReady } from "@/components/PageLoader";

type FadeUpProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function FadeUp({ children, className, delay = 0 }: FadeUpProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ready } = usePageReady();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  if (!ready) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px", amount: 0.15 }}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
