"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/login", { method: "DELETE" });
        window.location.href = "/admin/login";
      }}
      className="inline-flex items-center justify-center min-h-10 rounded-md border border-white/20 px-2.5 sm:px-3 text-[0.7rem] tracking-wide text-white/80 hover:text-gold-light hover:border-gold/40 transition-colors"
    >
      Logout
    </button>
  );
}
