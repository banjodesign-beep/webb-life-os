// src/components/ReminderPrompt.jsx
// A small pill at the bottom of the screen: "Turn on daily reminder".
// Shows only when push is possible and not yet switched on, then disappears for good.
// Lives outside App.jsx so App.jsx needs no edits.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const VAPID_PUBLIC_KEY =
  'BC4Shviauc16nf_lCh9jPVH9tsmlIwPuyCW9Q651kYBQYhCP_fruSBRuyzPnBjf1_zBEL4G_3DFgiM3vvOzJSuE';

function toUint8(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function saveSub(sub) {
  const { error } = await supabase
    .from('app_data')
    .upsert({ key: 'push_sub', value: sub.toJSON(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export default function ReminderPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported || Notification.permission === 'denied') return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (Notification.permission === 'granted' && existing) {
        saveSub(existing).catch(() => {}); // quietly keep the saved copy fresh
      } else {
        setShow(true);
      }
    });
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setShow(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(VAPID_PUBLIC_KEY) }));
      await saveSub(sub);
      setNote('Daily reminder on 🔔');
      setTimeout(() => setShow(false), 2000);
    } catch (e) {
      setNote('Could not turn on: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))',
      zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10,
        background: '#10171C', color: '#FFFFFF', borderRadius: 999, padding: '8px 8px 8px 16px',
        boxShadow: '0 8px 24px rgba(7,16,19,0.3)', fontSize: 14, fontWeight: 600,
      }}>
        <span>{note || 'Get a nudge each evening?'}</span>
        {!note && (
          <>
            <button type="button" onClick={enable} disabled={busy} style={{
              background: '#2B5F7D', color: '#FFFFFF', border: 'none', borderRadius: 999,
              padding: '8px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>{busy ? '…' : 'Turn on'}</button>
            <button type="button" aria-label="Dismiss" onClick={() => setShow(false)} style={{
              background: 'none', border: 'none', color: '#8B99A3', fontSize: 18, cursor: 'pointer', padding: '4px 8px',
            }}>×</button>
          </>
        )}
      </div>
    </div>
  );
}
