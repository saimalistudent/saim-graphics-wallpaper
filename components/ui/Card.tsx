import { cn } from "@/lib/utils";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
};

export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white shadow-md overflow-hidden border border-gold/20",
        hover &&
          "transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-burgundy/20 hover:border-gold/50",
        className
      )}
    >
      {children}
    </div>
  );
}
