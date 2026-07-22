import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "whatsapp" | "outline" | "ghost";
  href?: string;
};

const variants = {
  primary:
    "bg-gold-gradient text-burgundy font-semibold hover:scale-105 hover:shadow-lg hover:shadow-gold/40",
  whatsapp:
    "bg-whatsapp text-white hover:scale-105 hover:shadow-lg hover:shadow-whatsapp/30",
  outline:
    "border-2 border-gold text-gold bg-transparent hover:bg-gold hover:text-burgundy hover:scale-105",
  ghost: "text-[#1A1A1A] hover:bg-burgundy/5",
};

export function Button({
  className,
  variant = "primary",
  href,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    className
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
