"use client";
import React, { useEffect, useState } from "react";

type Group = { id: string; name: string };
type Contact = { id: string; name: string };
type Settings = { targetChatId: string; triggerPrefix: string; triggerWord: string; targetGroupId?: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [targetType, setTargetType] = useState<"group" | "person">("group");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await fetch("http://localhost:4000/api/settings").then((r) => r.json());
        const gRes = await fetch("http://localhost:4000/api/groups");
        const cRes = await fetch("http://localhost:4000/api/contacts");
        let g: { ok: boolean; groups?: Group[] } = { ok: false };
        let c: { ok: boolean; contacts?: Contact[] } = { ok: false };
        if (gRes.ok) g = await gRes.json();
        if (cRes.ok) c = await cRes.json();
        setSettings({
          targetChatId: s.targetChatId || s.targetGroupId || "",
          triggerPrefix: s.triggerPrefix || "",
          triggerWord: s.triggerWord || "",
          targetGroupId: s.targetGroupId || "",
        });
        setGroups(g.groups || []);
        setContacts(c.contacts || []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load settings";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:4000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetChatId: settings.targetChatId,
          triggerPrefix: settings.triggerPrefix,
          triggerWord: settings.triggerWord,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("Save failed");
      setSettings(data.settings);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save settings";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-4">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">WhatsApp RAG Bot Settings</h1>
      {error && (
        <div className="mt-4 text-red-600">{error}</div>
      )}

      {settings && (
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Target</label>
            <div className="flex items-center gap-3 mt-1">
              <button
                className={`px-3 py-1 rounded border text-sm ${targetType === 'group' ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'}`}
                onClick={() => setTargetType('group')}
              >Group</button>
              <button
                className={`px-3 py-1 rounded border text-sm ${targetType === 'person' ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'}`}
                onClick={() => setTargetType('person')}
              >Person</button>
            </div>
            {targetType === 'group' ? (
              <select
                className="mt-2 w-full border rounded p-2"
                value={settings.targetChatId}
                onChange={(e) => setSettings({ ...settings, targetChatId: e.target.value })}
              >
                <option value="">(Select a group)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            ) : (
              <select
                className="mt-2 w-full border rounded p-2"
                value={settings.targetChatId}
                onChange={(e) => setSettings({ ...settings, targetChatId: e.target.value })}
              >
                <option value="">(Select a person)</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {!groups.length && !contacts.length && (
              <p className="text-xs text-gray-500 mt-1">Lists not ready yet — ensure WhatsApp is linked and client is ready.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Trigger Prefix</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={settings.triggerPrefix}
              onChange={(e) => setSettings({ ...settings, triggerPrefix: e.target.value })}
              placeholder="Hey chatbot"
            />
            <p className="text-xs text-gray-500 mt-1">Used in target group: e.g., &quot;Hey chatbot, summarize yesterday&quot;.</p>
          </div>

          <div>
            <label className="block text-sm font-medium">Trigger Word</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={settings.triggerWord}
              onChange={(e) => setSettings({ ...settings, triggerWord: e.target.value })}
              placeholder="ask"
            />
            <p className="text-xs text-gray-500 mt-1">Used anywhere: e.g., &quot;ask what did we discuss last week?&quot;.</p>
          </div>

          <div className="pt-2">
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
