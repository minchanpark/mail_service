/* ============================================================
   Inbox One — Backend-ready React app
   ------------------------------------------------------------
   서버리스 백엔드(Firebase / Supabase / 자체 mock)에 갈아끼울 수
   있도록 어댑터 패턴으로 리팩토링한 버전입니다.

   구조 (단일 파일이지만 논리적으로 분리):
     [1] Types (JSDoc)         — 데이터 모델 정의
     [2] Backend Adapter       — Firebase / Supabase / Mock 구현체
     [3] BackendContext        — 의존성 주입
     [4] Hooks                 — useThreads, useThread, useAccounts, ...
     [5] UI Components         — Sidebar / ThreadList / Detail
     [6] App                   — 조립

   실제 프로덕션 배포 시:
     - lib/backend/types.ts          ← [1]
     - lib/backend/{firebase,supabase,mock}.ts ← [2]
     - lib/backend/context.tsx       ← [3]
     - hooks/use*.ts                 ← [4]
     - components/inbox/*.tsx        ← [5]
     - pages/inbox.tsx               ← [6]
   처럼 분리하시면 됩니다.
   ============================================================ */

import React, { useState, useEffect, useMemo, useCallback, useContext, createContext } from 'react';
import {
  Inbox, Star, Send, Clock, ChevronRight, Sparkles, Search, Settings,
  Pencil, Plus, Paperclip, Filter, Archive, Trash2, Tag, CalendarDays,
  ListTodo, Forward, Moon, Sun, ChevronLeft, Receipt, Bell, Newspaper,
  AlertCircle, Loader2,
} from 'lucide-react';

/* ============================================================
   [1] TYPES (JSDoc — 실제 코드는 TS로 정의 권장)
   ============================================================ */

/**
 * @typedef {'gmail' | 'outlook' | 'naver'} Provider
 * @typedef {'important'|'newsletter'|'transaction'|'automation'|'other'} Category
 *
 * @typedef {Object} ThreadFilter
 * @property {'all'|'unread'|'needsReply'|'starred'|'sent'|'snoozed'} kind
 * @property {string=} accountId
 * @property {Category=} category
 * @property {string=} labelId
 */


/* ============================================================
   [2] BACKEND ADAPTER
   ------------------------------------------------------------
   모든 백엔드는 동일한 인터페이스를 구현합니다. UI 컴포넌트는
   adapter를 직접 호출하지 않고 hooks를 통해서만 접근합니다.
   ============================================================ */

/* ----------------- MOCK ADAPTER (데모용) ----------------- */

function createMockAdapter() {
  const store = {
    user: { id: 'u_local', email: 'local@inbox.one', displayName: '로컬 사용자' },
    accounts: [],
    labels: [],
    threads: SEED_THREADS(),
  };
  const subs = new Set();
  const notify = () => subs.forEach(fn => fn());
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function applyFilter(items, f) {
    let out = items;
    if (f?.kind === 'unread')     out = out.filter(t => t.unread);
    if (f?.kind === 'needsReply') out = out.filter(t => t.hasAction);
    if (f?.kind === 'starred')    out = out.filter(t => t.starred);
    if (f?.accountId)             out = out.filter(t => t.accountId === f.accountId);
    if (f?.category)              out = out.filter(t => t.category === f.category);
    if (f?.labelId)               out = out.filter(t => t.labelIds?.includes(f.labelId));
    return out;
  }

  return {
    name: 'mock',
    auth: {
      getCurrentUser: async () => { await sleep(40); return store.user; },
      onAuthChange:   (cb) => { cb(store.user); return () => {}; },
      signIn:         async () => store.user,
      signOut:        async () => { store.user = null; },
    },
    accounts: {
      list:       async () => { await sleep(80); return [...store.accounts]; },
      connect:    async () => { throw new Error('Mock: OAuth not available'); },
      disconnect: async (id) => { store.accounts = store.accounts.filter(a => a.id !== id); notify(); },
    },
    threads: {
      list: async (filter) => {
        await sleep(120);
        return { items: applyFilter(store.threads, filter) };
      },
      get: async (id) => {
        await sleep(60);
        return store.threads.find(t => t.id === id) || null;
      },
      update: async (id, patch) => {
        await sleep(60);
        const i = store.threads.findIndex(t => t.id === id);
        if (i < 0) throw new Error('Thread not found');
        store.threads[i] = { ...store.threads[i], ...patch };
        notify();
        return store.threads[i];
      },
      subscribe: (filter, cb) => {
        const fn = () => cb(applyFilter(store.threads, filter));
        subs.add(fn);
        fn();
        return () => subs.delete(fn);
      },
    },
    ai: {
      summarize: async (threadId) => {
        await sleep(800);
        const t = store.threads.find(x => x.id === threadId);
        if (!t) throw new Error('Thread not found');
        return t.summary || {
          oneLine: t.preview.slice(0, 80),
          threeLines: [t.preview.slice(0, 60), '추가 컨텍스트가 필요합니다.', '회신 필요 여부 확인 중.'],
          status: 'ready', model: 'local-demo', updatedAt: new Date().toISOString(),
        };
      },
      generateReply: async () => {
        await sleep(1200);
        return {
          variants: [
            { label: '간결',      body: '확인했습니다. 금요일까지 회신드리겠습니다.' },
            { label: '협조적',    body: '공유 감사합니다. 내부 검토 후 금요일 오후까지 회신드리겠습니다.' },
            { label: '정중·길게', body: '안녕하세요, 자세한 자료 공유 감사드립니다. 법무 검토를 거쳐 금요일 오후 6시 이전에 정리된 의견으로 회신드리겠습니다.' },
          ],
        };
      },
      reclassify: async () => ({ category: 'important', suggestedLabelIds: [] }),
    },
    labels: {
      list:   async () => [...store.labels],
      create: async (l) => { const x = { ...l, id: 'l_' + Date.now(), userId: store.user.id }; store.labels.push(x); notify(); return x; },
      update: async (id, p) => { const i = store.labels.findIndex(x => x.id === id); store.labels[i] = { ...store.labels[i], ...p }; notify(); return store.labels[i]; },
      remove: async (id) => { store.labels = store.labels.filter(x => x.id !== id); notify(); },
    },
    briefing: {
      getDaily: async () => ({
        received: 0, important: 0, needsReply: 0, autoFiled: 0,
        timeSavedLabel: '0분', dateLabel: '초기 상태',
        topUrgent: [],
      }),
    },
  };
}


/* ----------------- FIREBASE ADAPTER (스켈레톤) ----------------- */
/*
  실제 코드 예시 (주석으로 유지 — 실제 배포 시 활성화):

  import { initializeApp } from 'firebase/app';
  import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
  import {
    getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy,
    limit as qlimit, startAfter, updateDoc, onSnapshot, addDoc, deleteDoc,
    serverTimestamp,
  } from 'firebase/firestore';
  import { getFunctions, httpsCallable } from 'firebase/functions';

  Cloud Functions (서울 리전 권장):
    asia-northeast3 / oauthInitiate / aiSummarize / aiGenerateReply / aiReclassify / briefingDaily / syncEmails
*/
function createFirebaseAdapter(/* { app } */) {
  const NI = () => { throw new Error('Firebase adapter: not wired yet — see comments'); };
  return {
    name: 'firebase',
    auth: {
      // getCurrentUser: () => Promise.resolve(getAuth(app).currentUser ? mapUser(getAuth(app).currentUser) : null),
      // onAuthChange:   (cb) => onAuthStateChanged(getAuth(app), (u) => cb(u ? mapUser(u) : null)),
      // signIn: async () => { const r = await signInWithPopup(getAuth(app), new GoogleAuthProvider()); return mapUser(r.user); },
      // signOut: () => signOut(getAuth(app)),
      getCurrentUser: NI, onAuthChange: NI, signIn: NI, signOut: NI,
    },
    accounts: {
      // list: async () => {
      //   const snap = await getDocs(query(collection(getFirestore(app), 'accounts'),
      //     where('userId', '==', getAuth(app).currentUser.uid)));
      //   return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // },
      // connect: async (provider) => {
      //   const fn = httpsCallable(getFunctions(app, 'asia-northeast3'), 'oauthInitiate');
      //   const { data } = await fn({ provider });
      //   window.location.href = data.authorizeUrl;          // 서버에서 OAuth URL 생성
      // },
      // disconnect: async (id) => deleteDoc(doc(getFirestore(app), 'accounts', id)),
      list: NI, connect: NI, disconnect: NI,
    },
    threads: {
      // list: async (filter, opts) => {
      //   const db = getFirestore(app);
      //   const c = [where('userId', '==', getAuth(app).currentUser.uid),
      //              orderBy('receivedAt', 'desc'), qlimit(opts?.limit ?? 50)];
      //   if (filter?.accountId) c.push(where('accountId', '==', filter.accountId));
      //   if (filter?.category)  c.push(where('category',  '==', filter.category));
      //   if (filter?.labelId)   c.push(where('labelIds',  'array-contains', filter.labelId));
      //   if (filter?.kind === 'unread')     c.push(where('unread',    '==', true));
      //   if (filter?.kind === 'starred')    c.push(where('starred',   '==', true));
      //   if (filter?.kind === 'needsReply') c.push(where('hasAction', '==', true));
      //   if (opts?.cursor) c.push(startAfter(opts.cursor));
      //   const snap = await getDocs(query(collection(db, 'threads'), ...c));
      //   return { items: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
      // },
      // get: async (id) => { const s = await getDoc(doc(getFirestore(app), 'threads', id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
      // update: async (id, patch) => { await updateDoc(doc(getFirestore(app), 'threads', id), { ...patch, updatedAt: serverTimestamp() });
      //   const s = await getDoc(doc(getFirestore(app), 'threads', id)); return { id: s.id, ...s.data() }; },
      // subscribe: (filter, cb) => { /* build query like list(), then onSnapshot(q, snap => cb(snap.docs.map(d => ({...})))); */ },
      list: NI, get: NI, update: NI, subscribe: NI,
    },
    ai: {
      // summarize:     async (threadId)       => (await httpsCallable(getFunctions(app, 'asia-northeast3'), 'aiSummarize')({ threadId })).data,
      // generateReply: async (threadId, opts) => (await httpsCallable(getFunctions(app, 'asia-northeast3'), 'aiGenerateReply')({ threadId, ...opts })).data,
      // reclassify:    async (threadId)       => (await httpsCallable(getFunctions(app, 'asia-northeast3'), 'aiReclassify')({ threadId })).data,
      summarize: NI, generateReply: NI, reclassify: NI,
    },
    labels: {
      // list:   async ()      => (await getDocs(query(collection(getFirestore(app), 'labels'), where('userId', '==', getAuth(app).currentUser.uid)))).docs.map(d => ({ id: d.id, ...d.data() })),
      // create: async (l)     => { const r = await addDoc(collection(getFirestore(app), 'labels'), { ...l, userId: getAuth(app).currentUser.uid }); return { id: r.id, ...l }; },
      // update: async (id, p) => { await updateDoc(doc(getFirestore(app), 'labels', id), p); return { id, ...p }; },
      // remove: async (id)    => deleteDoc(doc(getFirestore(app), 'labels', id)),
      list: NI, create: NI, update: NI, remove: NI,
    },
    briefing: {
      // getDaily: async () => (await httpsCallable(getFunctions(app, 'asia-northeast3'), 'briefingDaily')()).data,
      getDaily: NI,
    },
  };
}


/* ----------------- SUPABASE ADAPTER (스켈레톤) ----------------- */
/*
  import { createClient } from '@supabase/supabase-js';
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  Edge Functions: oauth-initiate / ai-summarize / ai-generate-reply / ai-reclassify / briefing-daily / sync-emails
*/
function createSupabaseAdapter(/* { client } */) {
  const NI = () => { throw new Error('Supabase adapter: not wired yet — see comments'); };
  return {
    name: 'supabase',
    auth: {
      // getCurrentUser: async () => { const { data: { user } } = await sb.auth.getUser(); return user ? mapUser(user) : null; },
      // onAuthChange: (cb) => { const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user ? mapUser(s.user) : null)); return () => subscription.unsubscribe(); },
      // signIn: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }),
      // signOut: () => sb.auth.signOut(),
      getCurrentUser: NI, onAuthChange: NI, signIn: NI, signOut: NI,
    },
    accounts: {
      // list: async () => { const { data, error } = await sb.from('email_accounts').select('*'); if (error) throw error; return data.map(rowToAccount); },
      // connect: async (provider) => { const { data, error } = await sb.functions.invoke('oauth-initiate', { body: { provider } }); if (error) throw error; window.location.href = data.authorizeUrl; },
      // disconnect: async (id) => { const { error } = await sb.from('email_accounts').delete().eq('id', id); if (error) throw error; },
      list: NI, connect: NI, disconnect: NI,
    },
    threads: {
      // list: async (filter, opts) => {
      //   let q = sb.from('threads').select('*').order('received_at', { ascending: false }).limit(opts?.limit ?? 50);
      //   if (filter?.accountId) q = q.eq('account_id', filter.accountId);
      //   if (filter?.category)  q = q.eq('category',   filter.category);
      //   if (filter?.labelId)   q = q.contains('label_ids', [filter.labelId]);
      //   if (filter?.kind === 'unread')     q = q.eq('unread', true);
      //   if (filter?.kind === 'starred')    q = q.eq('starred', true);
      //   if (filter?.kind === 'needsReply') q = q.eq('has_action', true);
      //   const { data, error } = await q; if (error) throw error;
      //   return { items: data.map(rowToThread) };
      // },
      // get: async (id) => { const { data, error } = await sb.from('threads').select('*').eq('id', id).single(); if (error) throw error; return rowToThread(data); },
      // update: async (id, patch) => { const { data, error } = await sb.from('threads').update(threadToRow(patch)).eq('id', id).select().single(); if (error) throw error; return rowToThread(data); },
      // subscribe: (filter, cb) => {
      //   const channel = sb.channel(`threads:${JSON.stringify(filter)}`)
      //     .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' },
      //         async () => { const { items } = await this.list(filter); cb(items); })
      //     .subscribe();
      //   return () => sb.removeChannel(channel);
      // },
      list: NI, get: NI, update: NI, subscribe: NI,
    },
    ai: {
      // summarize:     async (threadId)       => { const { data, error } = await sb.functions.invoke('ai-summarize',     { body: { threadId } });          if (error) throw error; return data; },
      // generateReply: async (threadId, opts) => { const { data, error } = await sb.functions.invoke('ai-generate-reply', { body: { threadId, ...opts } }); if (error) throw error; return data; },
      // reclassify:    async (threadId)       => { const { data, error } = await sb.functions.invoke('ai-reclassify',     { body: { threadId } });          if (error) throw error; return data; },
      summarize: NI, generateReply: NI, reclassify: NI,
    },
    labels: {
      // list:   async ()      => { const { data, error } = await sb.from('labels').select('*'); if (error) throw error; return data; },
      // create: async (l)     => { const { data, error } = await sb.from('labels').insert(l).select().single(); if (error) throw error; return data; },
      // update: async (id, p) => { const { data, error } = await sb.from('labels').update(p).eq('id', id).select().single(); if (error) throw error; return data; },
      // remove: async (id)    => { const { error } = await sb.from('labels').delete().eq('id', id); if (error) throw error; },
      list: NI, create: NI, update: NI, remove: NI,
    },
    briefing: {
      // getDaily: async () => { const { data, error } = await sb.functions.invoke('briefing-daily'); if (error) throw error; return data; },
      getDaily: NI,
    },
  };
}


/* ============================================================
   [3] BACKEND CONTEXT — 의존성 주입
   ============================================================ */

const BackendContext = createContext(null);

function BackendProvider({ adapter, children }) {
  return <BackendContext.Provider value={adapter}>{children}</BackendContext.Provider>;
}

function useBackend() {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used inside <BackendProvider>');
  return ctx;
}


/* ============================================================
   [4] HOOKS — UI는 어댑터를 직접 호출하지 않습니다
   ============================================================ */

function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    Promise.resolve(fn())
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err  => { if (!cancelled) setState({ data: null, loading: false, error: err }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function useThreads(filter) {
  const backend = useBackend();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);

    if (backend.threads.subscribe) {
      const unsub = backend.threads.subscribe(filter, (next) => {
        if (cancelled) return;
        setItems(next); setLoading(false);
      });
      return () => { cancelled = true; unsub(); };
    } else {
      backend.threads.list(filter)
        .then(({ items }) => { if (!cancelled) { setItems(items); setLoading(false); } })
        .catch(err => { if (!cancelled) { setError(err); setLoading(false); } });
      return () => { cancelled = true; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, filterKey]);

  return { items, loading, error };
}

function useThread(id) {
  const backend = useBackend();
  return useAsync(() => id ? backend.threads.get(id) : Promise.resolve(null), [backend, id]);
}

function useAccounts() { const b = useBackend(); return useAsync(() => b.accounts.list(), [b]); }
function useLabels()   { const b = useBackend(); return useAsync(() => b.labels.list(),   [b]); }
function useBriefing() { const b = useBackend(); return useAsync(() => b.briefing.getDaily(), [b]); }

function useUpdateThread() {
  const backend = useBackend();
  return useCallback((id, patch) => backend.threads.update(id, patch), [backend]);
}

function useGenerateReply() {
  const backend = useBackend();
  const [state, setState] = useState({ loading: false, variants: null, error: null });
  const run = useCallback(async (threadId, opts) => {
    setState({ loading: true, variants: null, error: null });
    try {
      const r = await backend.ai.generateReply(threadId, opts);
      setState({ loading: false, variants: r.variants, error: null });
      return r;
    } catch (e) {
      setState({ loading: false, variants: null, error: e });
      throw e;
    }
  }, [backend]);
  return { ...state, run };
}


/* ============================================================
   [5] UI COMPONENTS
   ============================================================ */

function ProviderDot({ provider, size = 8 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: `var(--${provider})`, flexShrink: 0,
    }}/>
  );
}

function Avatar({ name, size = 32, provider }) {
  const colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
  const c = colors[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: c,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 600, fontSize: size * 0.4, flexShrink: 0,
      position: 'relative', letterSpacing: '-0.01em',
    }}>
      {name.trim().charAt(0)}
      {provider && (
        <span style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 10, height: 10, borderRadius: '50%',
          background: `var(--${provider})`, border: '2px solid var(--bg-0)',
        }}/>
      )}
    </div>
  );
}

function LabelPill({ label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500,
      background: `${label.color}15`, color: label.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: label.color }}/>
      {label.name}
    </span>
  );
}

function Kbd({ children, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 4px', borderRadius: 4,
      background: 'var(--bg-3)', color: 'var(--fg-1)',
      fontFamily: 'var(--font-mono)', fontSize: 11,
      border: '1px solid var(--border)', boxShadow: '0 1px 0 var(--border)',
      ...style,
    }}>{children}</span>
  );
}

function SidebarItem({ icon, label, count, color, active, onClick, leading }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '6px 10px', border: 'none',
        background: active ? 'var(--accent-soft)' : hover ? 'var(--bg-2)' : 'transparent',
        borderRadius: 6,
        color: active ? 'var(--accent-soft-fg)' : 'var(--fg-1)',
        fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s',
      }}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }}/>}
      {leading}
      {icon && <span style={{ color: active ? 'var(--accent)' : 'var(--fg-2)', display: 'flex' }}>{icon}</span>}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && (
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{count}</span>
      )}
    </button>
  );
}

function SectionHeader({ open, setOpen, icon, children }) {
  return (
    <button onClick={() => setOpen(!open)} style={{
      display: 'flex', alignItems: 'center', gap: 4, width: '100%',
      padding: '4px 10px', border: 'none', background: 'transparent',
      color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'flex' }}>
        <ChevronRight size={10}/>
      </span>
      {icon} {children}
    </button>
  );
}

function Sidebar({ selected, setSelected }) {
  const [accountsOpen, setAccountsOpen]     = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [labelsOpen, setLabelsOpen]         = useState(true);
  const accounts = useAccounts();
  const labels   = useLabels();

  return (
    <aside style={{
      width: 'var(--sidebar-w)', height: '100%', background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <Inbox size={14} strokeWidth={2.5}/>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', flex: 1 }}>Inbox One</div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <Settings size={14}/>
        </button>
      </div>

      <div style={{ padding: '0 12px 10px' }}>
        <button style={{
          width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
          borderRadius: 8, background: 'var(--bg-0)', color: 'var(--fg-0)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={13}/> 새 메일 작성
          </span>
          <Kbd>C</Kbd>
        </button>
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 6,
          fontSize: 13, color: 'var(--fg-2)',
        }}>
          <Search size={13}/>
          <span style={{ flex: 1 }}>검색</span>
          <Kbd>⌘K</Kbd>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 16px', fontSize: 13 }}>
        <div style={{ padding: '4px 0' }}>
          <SidebarItem icon={<Inbox size={14}/>} label="통합 인박스" count={50}
            active={selected.kind === 'all' && !selected.accountId && !selected.category && !selected.labelId}
            onClick={() => setSelected({ kind: 'all' })}/>
          <SidebarItem icon={<Star size={14} fill="currentColor"/>} label="별표" count={3}
            active={selected.kind === 'starred'} onClick={() => setSelected({ kind: 'starred' })}/>
          <SidebarItem icon={<Send size={14}/>} label="보낸편지함"
            active={selected.kind === 'sent'} onClick={() => setSelected({ kind: 'sent' })}/>
          <SidebarItem icon={<Clock size={14}/>} label="스누즈" count={2}
            active={selected.kind === 'snoozed'} onClick={() => setSelected({ kind: 'snoozed' })}/>
        </div>

        <div style={{ marginTop: 16 }}>
          <SectionHeader open={accountsOpen} setOpen={setAccountsOpen}>계정</SectionHeader>
          {accountsOpen && (
            <div style={{ marginTop: 2 }}>
              {accounts.loading && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fg-3)' }}>로딩…</div>}
              {accounts.data?.map(a => (
                <SidebarItem key={a.id}
                  leading={<ProviderDot provider={a.provider}/>}
                  label={a.email.split('@')[0]} count={a.unreadCount}
                  active={selected.accountId === a.id}
                  onClick={() => setSelected({ kind: 'all', accountId: a.id })}/>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <SectionHeader open={categoriesOpen} setOpen={setCategoriesOpen} icon={<Sparkles size={11}/>}>AI 카테고리</SectionHeader>
          {categoriesOpen && (
            <div style={{ marginTop: 2 }}>
              <SidebarItem icon={<Star size={14}/>}      label="중요"        count={5}  active={selected.category === 'important'}    onClick={() => setSelected({ kind: 'all', category: 'important' })}/>
              <SidebarItem icon={<Newspaper size={14}/>} label="뉴스레터"     count={23} active={selected.category === 'newsletter'}   onClick={() => setSelected({ kind: 'all', category: 'newsletter' })}/>
              <SidebarItem icon={<Receipt size={14}/>}   label="거래·영수증" count={14} active={selected.category === 'transaction'} onClick={() => setSelected({ kind: 'all', category: 'transaction' })}/>
              <SidebarItem icon={<Bell size={14}/>}      label="자동화·알림" count={47} active={selected.category === 'automation'}  onClick={() => setSelected({ kind: 'all', category: 'automation' })}/>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <SectionHeader open={labelsOpen} setOpen={setLabelsOpen}>라벨</SectionHeader>
          {labelsOpen && (
            <div style={{ marginTop: 2 }}>
              {labels.data?.map(l => (
                <SidebarItem key={l.id} color={l.color} label={l.name}
                  active={selected.labelId === l.id}
                  onClick={() => setSelected({ kind: 'all', labelId: l.id })}/>
              ))}
              <SidebarItem icon={<Plus size={14}/>} label="라벨 추가" onClick={() => {}}/>
            </div>
          )}
        </div>
      </div>

      <div style={{
        borderTop: '1px solid var(--border)', padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Avatar name="김민지" size={28}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>김민지</div>
          <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>Pro · {accounts.data?.length ?? 0} 계정</div>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <Settings size={14}/>
        </button>
      </div>
    </aside>
  );
}

function AIBriefingCard() {
  const { data: b, loading } = useBriefing();
  if (loading || !b) return (
    <div style={{ margin: '12px 12px 6px', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', height: 120, background: 'var(--bg-2)' }}/>
  );
  const stats = [
    { k: b.received,    v: '수신',     color: 'var(--fg-0)' },
    { k: b.important,   v: '중요',     color: 'var(--accent)' },
    { k: b.needsReply,  v: '답장 필요', color: 'var(--label-orange)' },
    { k: b.autoFiled,   v: '자동 분류', color: 'var(--fg-1)' },
  ];
  return (
    <div style={{
      margin: '12px 12px 6px', padding: '14px 16px',
      background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-0) 100%)',
      border: '1px solid var(--border)', borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ display: 'flex', color: 'var(--accent)' }}><Sparkles size={13}/></span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--accent-soft-fg)', textTransform: 'uppercase' }}>오늘의 AI 브리핑</span>
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{b.dateLabel}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        {stats.map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: s.color, lineHeight: 1.1 }}>{s.k}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5 }}>
        {b.topUrgent.map((u, i) => <span key={u.threadId}>{i > 0 && '·'}<b>{u.title}</b></span>)}
        이 오늘 가장 시급해요.
        <span style={{ color: 'var(--fg-2)' }}> 예상 절약 시간 </span>
        <b style={{ color: 'var(--accent)' }}>{b.timeSavedLabel}</b>
      </div>
    </div>
  );
}

function ThreadRow({ thread, account, allLabels, selected, onClick }) {
  const labels = (thread.labelIds || []).map(id => allLabels?.find(l => l.id === id)).filter(Boolean);
  const [hover, setHover] = useState(false);
  const hasSummary = thread.summary?.status === 'ready';
  const summaryText = hasSummary ? thread.summary.oneLine : (thread.preview || '요약 생성 중…');

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 14px', minHeight: 64,
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', position: 'relative',
        background: selected ? 'var(--accent-soft)' : hover ? 'var(--bg-2)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'background 0.12s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {account && <ProviderDot provider={account.provider}/>}
        {thread.unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}/>}
        <span style={{
          fontSize: 13, fontWeight: thread.unread ? 700 : 500, color: 'var(--fg-0)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{thread.from}</span>
        {thread.starred && <Star size={12} fill="#f59e0b" stroke="#f59e0b" style={{ flexShrink: 0 }}/>}
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{thread.time}</span>
      </div>
      <div style={{
        fontSize: 13, fontWeight: thread.unread ? 600 : 500, color: 'var(--fg-0)',
        marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{thread.subject}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', marginTop: 2 }}>
          {hasSummary ? <Sparkles size={10}/> : <Loader2 size={10} className="io-spin"/>}
        </span>
        <span style={{
          fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.45,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{summaryText}</span>
      </div>
      {(labels.length > 0 || thread.attachments?.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {labels.map(l => <LabelPill key={l.id} label={l}/>)}
          {thread.attachments?.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-2)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Paperclip size={11}/> {thread.attachments.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadList({ filter, setFilter, selectedId, onSelect }) {
  const accounts = useAccounts();
  const labels   = useLabels();
  const { items: threads, loading, error } = useThreads(filter);

  const tabs = [
    { id: 'all',        label: '전체' },
    { id: 'unread',     label: '읽지 않음' },
    { id: 'needsReply', label: '답장 필요' },
  ];

  return (
    <div style={{
      width: 'var(--list-w)', height: '100%', background: 'var(--bg-0)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>통합 인박스</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 5, display: 'flex' }}><Filter size={14}/></button>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 5, display: 'flex' }}><Settings size={14}/></button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => {
            const active = filter.kind === t.id;
            return (
              <button key={t.id} onClick={() => setFilter({ ...filter, kind: t.id })} style={{
                padding: '3px 10px', border: 'none', borderRadius: 6,
                background: active ? 'var(--bg-2)' : 'transparent',
                color: active ? 'var(--fg-0)' : 'var(--fg-2)',
                fontSize: 12, fontWeight: active ? 600 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      <AIBriefingCard/>

      <div style={{ padding: '0 14px', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: '0.04em', marginTop: 6, textTransform: 'uppercase' }}>오늘</div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>
            <Loader2 size={16} className="io-spin" style={{ verticalAlign: 'middle', marginRight: 6 }}/>
            메일 불러오는 중…
          </div>
        )}
        {error && (
          <div style={{ padding: 20, color: 'var(--label-red)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <AlertCircle size={14}/> {error.message}
          </div>
        )}
        {!loading && !error && threads.map(t => {
          const account = accounts.data?.find(a => a.id === t.accountId);
          return (
            <ThreadRow key={t.id} thread={t} account={account} allLabels={labels.data}
              selected={selectedId === t.id} onClick={() => onSelect(t.id)}/>
          );
        })}
        {!loading && !error && threads.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>
            해당하는 메일이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}

function ActionChip({ icon, label, primary, onClick, loading }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} disabled={loading}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 8,
        border: primary ? 'none' : '1px solid ' + (hover ? 'var(--border-strong)' : 'var(--border)'),
        background: primary ? (hover ? 'var(--accent-hover)' : 'var(--accent)') : (hover ? 'var(--bg-2)' : 'var(--bg-0)'),
        color: primary ? 'var(--accent-fg)' : 'var(--fg-0)',
        fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s ease', opacity: loading ? 0.7 : 1,
      }}>
      {loading ? <Loader2 size={13} className="io-spin"/> : icon}{label}
    </button>
  );
}

function ToolbarButton({ icon, label, kbd, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        background: hover ? 'var(--bg-2)' : 'transparent',
        border: '1px solid ' + (hover ? 'var(--border)' : 'transparent'),
        borderRadius: 6, color: 'var(--fg-1)',
        fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.12s',
      }}>
      {icon}<span>{label}</span><Kbd style={{ fontSize: 10 }}>{kbd}</Kbd>
    </button>
  );
}

function ReplyDraftPanel({ threadId, onClose }) {
  const reply = useGenerateReply();
  const [picked, setPicked] = useState(null);

  useEffect(() => { reply.run(threadId).catch(() => {}); /* eslint-disable-next-line */ }, [threadId]);

  return (
    <div style={{
      marginTop: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 10,
      background: 'var(--bg-1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Sparkles size={13} style={{ color: 'var(--accent)' }}/>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--accent-soft-fg)', textTransform: 'uppercase' }}>AI 답장 초안</span>
        <span style={{ flex: 1 }}/>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', fontSize: 12, cursor: 'pointer' }}>닫기</button>
      </div>
      {reply.loading && (
        <div style={{ padding: 16, color: 'var(--fg-2)', fontSize: 13, display: 'flex', gap: 6 }}>
          <Loader2 size={14} className="io-spin"/> 초안 생성 중…
        </div>
      )}
      {reply.error && <div style={{ color: 'var(--label-red)', fontSize: 12 }}>{reply.error.message}</div>}
      {reply.variants && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reply.variants.map((v, i) => (
            <div key={i} onClick={() => setPicked(i)} style={{
              padding: 12, borderRadius: 8, cursor: 'pointer',
              border: '1px solid ' + (picked === i ? 'var(--accent)' : 'var(--border)'),
              background: picked === i ? 'var(--accent-soft)' : 'var(--bg-0)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-soft-fg)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{v.label}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>{v.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ threadId }) {
  const accounts = useAccounts();
  const labels   = useLabels();
  const { data: thread, loading } = useThread(threadId);
  const updateThread = useUpdateThread();
  const [showReply, setShowReply] = useState(false);

  useEffect(() => { setShowReply(false); }, [threadId]);

  if (!threadId) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)', fontSize: 13 }}>메일을 선택하세요</div>;
  }
  if (loading || !thread) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)', fontSize: 13 }}>
      <Loader2 size={16} className="io-spin" style={{ marginRight: 6 }}/> 메일 불러오는 중…
    </div>;
  }

  const account = accounts.data?.find(a => a.id === thread.accountId);
  const threadLabels = (thread.labelIds || []).map(id => labels.data?.find(l => l.id === id)).filter(Boolean);
  const toggleStar = () => updateThread(thread.id, { starred: !thread.starred });

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <ToolbarButton icon={<Archive size={14}/>} label="보관" kbd="E" onClick={() => updateThread(thread.id, { archived: true })}/>
        <ToolbarButton icon={<Trash2 size={14}/>}  label="삭제" kbd="⌫"/>
        <ToolbarButton icon={<Clock size={14}/>}   label="스누즈" kbd="H"/>
        <ToolbarButton icon={<Tag size={14}/>}     label="라벨" kbd="L"/>
        <div style={{ flex: 1 }}/>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 6, display: 'flex' }}><ChevronLeft size={14}/></button>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>1 / 5</span>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 6, display: 'flex' }}><ChevronRight size={14}/></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 40px' }} className="io-fade-in" key={thread.id}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {threadLabels.map(l => <LabelPill key={l.id} label={l}/>)}
            {account && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                background: 'var(--bg-2)', color: 'var(--fg-2)',
              }}>
                <ProviderDot provider={account.provider} size={6}/> {account.label}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', lineHeight: 1.25 }}>{thread.subject}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <Avatar name={thread.from} size={40} provider={account?.provider}/>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{thread.from}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{'<' + thread.fromEmail + '>'}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>수신: 김민지 · {thread.date} {thread.time}</div>
          </div>
          <button onClick={toggleStar} style={{
            padding: '6px 10px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--fg-1)', cursor: 'pointer', display: 'flex',
          }}>
            {thread.starred ? <Star size={14} fill="#f59e0b" stroke="#f59e0b"/> : <Star size={14}/>}
          </button>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-1) 100%)',
          border: '1px solid var(--border)', borderRadius: 10,
          padding: '16px 18px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Sparkles size={13} style={{ color: 'var(--accent)' }}/>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--accent-soft-fg)', textTransform: 'uppercase' }}>AI 3줄 요약</span>
            <span style={{ flex: 1 }}/>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>재요약 ↻</button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>
            {(thread.summary?.threeLines || ['요약 생성 중…']).map((l, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{l}</li>
            ))}
          </ol>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          <ActionChip icon={<Sparkles size={13}/>}     label="답장 초안 생성" primary onClick={() => setShowReply(true)}/>
          <ActionChip icon={<CalendarDays size={13}/>} label="일정 등록"/>
          <ActionChip icon={<ListTodo size={13}/>}     label="할일 추가"/>
          <ActionChip icon={<Archive size={13}/>}      label="보관" onClick={() => updateThread(thread.id, { archived: true })}/>
          <ActionChip icon={<Forward size={13}/>}      label="팀에 전달"/>
        </div>

        <div style={{ fontSize: 14, color: 'var(--fg-0)', lineHeight: 1.7 }}>
          {thread.body || (
            <p style={{ color: 'var(--fg-2)', fontStyle: 'italic' }}>{thread.preview}</p>
          )}
        </div>

        {thread.attachments?.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: '0.04em', marginBottom: 10, textTransform: 'uppercase' }}>첨부 {thread.attachments.length}개</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {thread.attachments.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--bg-1)', cursor: 'pointer',
                }}>
                  <div style={{
                    width: 28, height: 32, background: 'var(--accent-soft)', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', fontSize: 9, fontWeight: 700,
                  }}>{a.name.split('.').pop().toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{a.size}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showReply && <ReplyDraftPanel threadId={thread.id} onClose={() => setShowReply(false)}/>}
      </div>
    </div>
  );
}


/* ============================================================
   [6] APP — 조립
   ============================================================ */

const TOKENS_CSS = `
  :root {
    --bg-0:#fff; --bg-1:#fafaf9; --bg-2:#f4f4f3; --bg-3:#ececea;
    --border:#e6e6e3; --border-strong:#d6d6d2;
    --fg-0:#18181b; --fg-1:#3f3f46; --fg-2:#71717a; --fg-3:#a1a1aa;
    --accent:#2563eb; --accent-hover:#1d4ed8; --accent-fg:#fff;
    --accent-soft:#eff3ff; --accent-soft-fg:#1e3a8a;
    --gmail:#D14B3D; --outlook:#4A6FA5; --naver:#4A8F5C;
    --label-blue:#2563eb; --label-green:#059669; --label-orange:#d97706;
    --label-purple:#7c3aed; --label-red:#dc2626;
    --sidebar-w:240px; --list-w:380px;
    --font:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
    --font-mono:'SF Mono','Menlo','Consolas',monospace;
  }
  [data-theme="dark"] {
    --bg-0:#0c0c0d; --bg-1:#131316; --bg-2:#1a1a1f; --bg-3:#24242a;
    --border:#27272e; --border-strong:#34343c;
    --fg-0:#f4f4f5; --fg-1:#d4d4d8; --fg-2:#a1a1aa; --fg-3:#71717a;
    --accent:#3b82f6; --accent-hover:#60a5fa;
    --accent-soft:#1a2540; --accent-soft-fg:#93c5fd;
  }
  .io-root, .io-root * { box-sizing: border-box; }
  .io-root ::-webkit-scrollbar { width:10px; height:10px; }
  .io-root ::-webkit-scrollbar-track { background:transparent; }
  .io-root ::-webkit-scrollbar-thumb { background:var(--bg-3); border-radius:10px; border:2px solid var(--bg-1); }
  .io-root ::-webkit-scrollbar-thumb:hover { background:var(--border-strong); }
  @keyframes io-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .io-fade-in { animation: io-fade 0.35s cubic-bezier(0.2,0.8,0.2,1); }
  @keyframes io-rot { to { transform: rotate(360deg); } }
  .io-spin { animation: io-rot 0.9s linear infinite; }
`;

export default function InboxOneApp() {
  /* ──────────────────────────────────────────────────────────
     백엔드 선택 — 환경에 따라 어댑터를 갈아끼웁니다.
     실제 코드 예시:
       const adapter = useMemo(() => {
         if (process.env.NEXT_PUBLIC_BACKEND === 'firebase')  return createFirebaseAdapter({ app: firebaseApp });
         if (process.env.NEXT_PUBLIC_BACKEND === 'supabase')  return createSupabaseAdapter({ client: supabase });
         return createMockAdapter();
       }, []);
  ────────────────────────────────────────────────────────── */
  const adapter = useMemo(() => createMockAdapter(), []);

  return (
    <BackendProvider adapter={adapter}>
      <Shell/>
    </BackendProvider>
  );
}

function Shell() {
  const [theme, setTheme]           = useState('light');
  const [filter, setFilter]         = useState({ kind: 'all' });
  const [selectedId, setSelectedId] = useState('t1');
  const backend = useBackend();

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/dist/web/variable/pretendardvariable.css"/>
      <style>{TOKENS_CSS}</style>

      <div className="io-root" data-theme={theme} style={{
        width: '100%', height: '100vh', minHeight: 640,
        fontFamily: 'var(--font)',
        background: 'var(--bg-1)', color: 'var(--fg-0)',
        display: 'flex', flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
        fontFeatureSettings: "'ss01','ss02','cv01','cv11'",
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '6px 14px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-0)', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Inbox One · MVP · backend: {backend.name}
          </span>
          <div style={{ flex: 1 }}/>
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--fg-1)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {theme === 'light' ? <Moon size={12}/> : <Sun size={12}/>}
            {theme === 'light' ? '다크' : '라이트'}
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          <Sidebar selected={filter} setSelected={setFilter}/>
          <ThreadList filter={filter} setFilter={setFilter} selectedId={selectedId} onSelect={setSelectedId}/>
          <Detail threadId={selectedId}/>
        </div>
      </div>
    </>
  );
}


/* ============================================================
   SEED DATA — 빈 초기 데이터셋
   ============================================================ */

function SEED_THREADS() {
  return [];
}
