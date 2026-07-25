"use client";

import { FormEvent, useEffect, useState } from "react";
import { ContactSettings } from "@/lib/types";
import { DEFAULT_CONTACT_SETTINGS, normalizePkPhone } from "@/lib/contact";

export function ContactManager() {
  const [settings, setSettings] = useState<ContactSettings>(
    DEFAULT_CONTACT_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/contact");
        if (!res.ok) throw new Error("Failed to load contact settings");
        const data = (await res.json()) as ContactSettings & {
          _warning?: string;
        };
        if (cancelled) return;
        setSettings({ ...DEFAULT_CONTACT_SETTINGS, ...data });
        if (data._warning) {
          setError(
            "Run 007_contact_settings.sql in Supabase — showing defaults until table exists."
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof ContactSettings>(
    key: K,
    value: ContactSettings[K]
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          call_intro_ur: settings.call_intro_ur,
          call_button_label: settings.call_button_label,
          call_phone: settings.call_phone,
          whatsapp_intro_ur: settings.whatsapp_intro_ur,
          whatsapp_button_label: settings.whatsapp_button_label,
          whatsapp_phone: settings.whatsapp_phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings({
        ...DEFAULT_CONTACT_SETTINGS,
        ...(data as ContactSettings),
      });
      setMessage("Contact settings saved and live on the website.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-text-secondary text-sm">
        Loading contact settings…
      </p>
    );
  }

  const callDigits = normalizePkPhone(settings.call_phone);
  const waDigits = normalizePkPhone(settings.whatsapp_phone);

  return (
    <form
      onSubmit={handleSave}
      className="admin-card space-y-6 max-w-3xl"
    >
      <label className="flex items-center gap-3 text-sm font-medium text-burgundy">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => update("enabled", e.target.checked)}
          className="h-4 w-4 accent-[#4A0404]"
        />
        Show floating Contact button on website
      </label>

      <section className="space-y-3 rounded-lg border border-gold/25 bg-[#faf7f2] p-4">
        <h2 className="admin-card-title">Call</h2>
        <div>
          <label className="admin-label">Urdu intro line</label>
          <textarea
            dir="rtl"
            lang="ur"
            className="admin-input font-urdu"
            rows={2}
            value={settings.call_intro_ur}
            onChange={(e) => update("call_intro_ur", e.target.value)}
            placeholder={DEFAULT_CONTACT_SETTINGS.call_intro_ur}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="admin-label">Button label</label>
            <input
              type="text"
              className="admin-input"
              value={settings.call_button_label}
              onChange={(e) => update("call_button_label", e.target.value)}
              placeholder="CALL ONLY"
            />
          </div>
          <div>
            <label className="admin-label">Phone number</label>
            <input
              type="tel"
              className="admin-input"
              value={settings.call_phone}
              onChange={(e) => update("call_phone", e.target.value)}
              placeholder="0318 7976294"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Dialer opens as{" "}
              <span className="font-mono">
                {callDigits ? `tel:+${callDigits}` : "—"}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gold/25 bg-[#faf7f2] p-4">
        <h2 className="admin-card-title">WhatsApp</h2>
        <div>
          <label className="admin-label">Urdu intro line</label>
          <textarea
            dir="rtl"
            lang="ur"
            className="admin-input font-urdu"
            rows={2}
            value={settings.whatsapp_intro_ur}
            onChange={(e) => update("whatsapp_intro_ur", e.target.value)}
            placeholder={DEFAULT_CONTACT_SETTINGS.whatsapp_intro_ur}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="admin-label">Button label</label>
            <input
              type="text"
              className="admin-input"
              value={settings.whatsapp_button_label}
              onChange={(e) =>
                update("whatsapp_button_label", e.target.value)
              }
              placeholder="WHATSAPP ONLY"
            />
          </div>
          <div>
            <label className="admin-label">Phone number</label>
            <input
              type="tel"
              className="admin-input"
              value={settings.whatsapp_phone}
              onChange={(e) => update("whatsapp_phone", e.target.value)}
              placeholder="03127290072"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Chat opens at{" "}
              <span className="font-mono">
                {waDigits
                  ? `api.whatsapp.com/send?phone=${waDigits}`
                  : "—"}
              </span>{" "}
              (also used by PDF viewer)
            </p>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <button type="submit" className="golden-button" disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
