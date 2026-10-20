import { useRef, useSyncExternalStore } from 'react';
import {
  NEW_TICKETS,
  bookingConfirmation,
  bookingDraftToTicket,
  orderDraft,
  orderReadBack,
  respond,
  type EngineResult,
  type Reply,
} from '../ai/engine';
import { maskPii } from '../domain/pii';
import { ITEM_BY_KEY } from '../domain/catalogue';
import { DEFAULT_STANDARDS, DEPT_BY_ID, deptName } from '../domain/departments';
import { computeEscalation, escalationLabel } from '../domain/escalation';
import { validateTool } from '../domain/tools';
import type {
  BookingDraft,
  Card,
  Conversation,
  DepartmentId,
  DiningOrder,
  Guest,
  Lang,
  Message,
  Rating,
  Standards,
  Ticket,
  TicketDraft,
  TicketStatus,
} from '../domain/types';
import { DEFAULT_KNOWLEDGE, type Knowledge } from '../data/knowledge';
import { DEMO_GUEST_ID, demoGuests, liveSampleTickets, sampleHistory } from '../data/demo';
import { RemoteSync, type SyncStatus, type Transport } from './remote';

/**
 * The concierge's data: in-house guests, one conversation per guest, messages,
 * tickets and ratings. It lives in localStorage, is mirrored to other tabs with
 * BroadcastChannel, and to other devices through Supabase when sync is on.
 */

export interface State {
  v: 4;
  guests: Guest[];
  conversations: Conversation[];
  messages: Message[];
  tickets: Ticket[];
  ratings: Rating[];
  settings: { standards: Standards; knowledge: Knowledge };
  clockOffset: number;
  seq: number;
  startedAt: number;
  /** Monotonic revision and writing tab, so tabs only ever accept newer state. */
  rev: number;
  writer: string;
}

const KEY = 'rixos-concierge-state';
const CHANNEL = 'rixos-concierge';

function initialState(): State {
  const now = Date.now();
  return {
    v: 4,
    guests: demoGuests(now),
    conversations: [],
    messages: [],
    tickets: [...sampleHistory(now), ...liveSampleTickets(now)], // sample history derives from startedAt
    ratings: [],
    settings: {
      standards: structuredClone(DEFAULT_STANDARDS),
      knowledge: structuredClone(DEFAULT_KNOWLEDGE),
    },
    clockOffset: 0,
    seq: 1000,
    startedAt: now,
    rev: 0,
    writer: '',
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed.v === 4) return { ...parsed, rev: parsed.rev ?? 0, writer: parsed.writer ?? '' };
    }
  } catch {
    /* storage unavailable: fall through to a fresh demo */
  }
  return initialState();
}

let state: State = typeof window === 'undefined' ? initialState() : load();
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

type Bus = { type: 'tickets-created'; ids: string[] };
const busListeners = new Set<(e: Bus) => void>();
export function onStoreEvent(fn: (e: Bus) => void) {
  busListeners.add(fn);
  return () => {
    busListeners.delete(fn);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

const TAB_ID = Math.random().toString(36).slice(2, 10);

function isNewer(incoming: State) {
  const rev = incoming.rev ?? 0;
  return rev > state.rev || (rev === state.rev && (incoming.writer ?? '') > state.writer);
}

/** Local writes bump the revision, persist and broadcast. Remote states are adopted only if newer. */
function commit(next: State, local = true) {
  if (local) {
    next.rev = state.rev + 1;
    next.writer = TAB_ID;
  } else if (!isNewer(next)) return;
  state = next;
  if (local) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode or quota: keep working in memory */
    }
    if (!remote) channel?.postMessage(state);
  }
  emit();
}

if (channel) {
  channel.onmessage = (e: MessageEvent<State>) => {
    if (e.data?.v === 4 && !remote) commit(e.data, false);
  };
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue && !remote) {
      try {
        commit(JSON.parse(e.newValue) as State, false);
      } catch {
        /* ignore malformed */
      }
    }
  });
}

export function getState() {
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Subscribes to the store. Results are cached per state + selector, so derived arrays are stable. */
export function useStore<T>(selector: (s: State) => T): T {
  const cache = useRef<{ s: State; sel: (s: State) => T; v: T } | null>(null);
  const get = () => {
    const c = cache.current;
    if (c && c.s === state && c.sel === selector) return c.v;
    const v = selector(state);
    cache.current = { s: state, sel: selector, v };
    return v;
  };
  return useSyncExternalStore(subscribe, get, get);
}

export const now = () => Date.now() + state.clockOffset;

function update(fn: (draft: State) => void) {
  const next = structuredClone(state);
  fn(next);
  commit(next);
  remote?.enqueue(fn);
}

// ------------------------------------------------------------ cross-device

let remote: RemoteSync<State> | null = null;
let syncStatus: SyncStatus = 'local';
const statusListeners = new Set<() => void>();

/** What travels to the database: everything except the regenerated sample history. */
function toWire(s: State) {
  const { rev: _rev, writer: _writer, ...rest } = s;
  void _rev;
  void _writer;
  return { ...rest, tickets: s.tickets.filter((t) => !t.sample) };
}

function fromWire(w: unknown): State | null {
  const s = w as Partial<State> | null;
  if (
    !s ||
    s.v !== 4 ||
    !Array.isArray(s.tickets) ||
    !Array.isArray(s.guests) ||
    typeof s.startedAt !== 'number'
  )
    return null;
  return {
    ...(s as State),
    tickets: [...sampleHistory(s.startedAt), ...s.tickets],
    rev: state.rev,
    writer: state.writer,
  };
}

export function getSyncStatus() {
  return syncStatus;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => {
        statusListeners.delete(l);
      };
    },
    () => syncStatus,
    () => syncStatus,
  );
}

/** Starts cross-device sync through Supabase. Falls back to this device only if it is unreachable. */
let syncStarted = false;
export async function startSync(transportFactory: () => Promise<Transport>) {
  if (syncStarted) return;
  syncStarted = true;
  let transport: Transport;
  try {
    transport = await transportFactory();
  } catch {
    syncStatus = 'offline';
    statusListeners.forEach((l) => l());
    return;
  }
  remote = new RemoteSync<State>(transport, {
    toWire,
    fromWire,
    getLocal: () => state,
    setLocal: (s) => commit(s),
    clone: (s) => structuredClone(s),
    onStatus: (st) => {
      syncStatus = st;
      statusListeners.forEach((l) => l());
    },
  });
  await remote.start();
}

let msgCounter = 0;
function msgId() {
  msgCounter += 1;
  return `m-${Date.now().toString(36)}-${msgCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

const tr = (lang: 'en' | 'ar', en: string, ar: string) => (lang === 'ar' ? ar : en);
const stamp = (s: State) => Date.now() + s.clockOffset;
const emitCreated = (created: Ticket[]) => {
  if (created.length)
    busListeners.forEach((l) => l({ type: 'tickets-created', ids: created.map((t) => t.id) }));
};

export { DEMO_GUEST_ID };
export const conversationId = (guestId: string) => `c-${guestId}`;

export function guestById(s: State, guestId: string): Guest | undefined {
  return s.guests.find((g) => g.id === guestId);
}

export function conversationOf(s: State, guestId: string): Conversation | undefined {
  return s.conversations.find((c) => c.guestId === guestId);
}

export function messagesOf(s: State, guestId: string): Message[] {
  const id = conversationId(guestId);
  return s.messages.filter((m) => m.conversationId === id);
}

/** The guest and their conversation, created on first use. Undefined if the guest is unknown. */
function party(s: State, guestId: string): { guest: Guest; conv: Conversation } | undefined {
  const guest = guestById(s, guestId);
  if (!guest) return undefined;
  let conv = conversationOf(s, guestId);
  if (!conv) {
    conv = { id: conversationId(guestId), guestId, mode: 'ai', lang: 'en' };
    s.conversations.push(conv);
  }
  return { guest, conv };
}

function pushMessage(
  s: State,
  conv: Conversation,
  m: Omit<Message, 'id' | 'conversationId' | 'at'> & { at?: number },
): Message {
  const msg: Message = { id: msgId(), conversationId: conv.id, at: m.at ?? stamp(s), ...m };
  s.messages.push(msg);
  return msg;
}

// ------------------------------------------------------------------ tickets

/** Server-side style validation: every draft must pass its tool schema before it becomes a ticket. */
export function validateDraft(d: TicketDraft): { ok: true } | { ok: false; error: string } {
  const base = validateTool('create_service_request', {
    department: d.department,
    category: d.category,
    item: d.item,
    quantity: d.quantity,
    details: d.details,
    preferred_time: d.preferredTime,
    priority: d.priority,
  });
  if (!base.ok) return base;
  if (d.kind === 'dining') return validateTool('create_dining_order', d.payload);
  if (d.kind === 'reservation') return validateTool('create_reservation', d.payload);
  if (d.kind === 'spa') return validateTool('create_spa_booking', d.payload);
  if (d.kind === 'transport') return validateTool('request_transport', d.payload);
  return { ok: true };
}

function createTickets(
  s: State,
  guest: Guest,
  drafts: TicketDraft[],
  original: string | undefined,
  lang: Lang,
): Ticket[] {
  const created: Ticket[] = [];
  for (const d of drafts) {
    const v = validateDraft(d);
    if (!v.ok) {
      console.warn('Rejected invalid request', v.error);
      continue;
    }
    s.seq += 1;
    const t: Ticket = {
      id: `T-${s.seq}`,
      department: d.department,
      alsoNotify: d.alsoNotify,
      category: d.category,
      item: d.item,
      itemKey: d.itemKey,
      quantity: d.quantity,
      details: d.details,
      preferredTime: d.preferredTime,
      room: guest.room,
      guestId: guest.id,
      guestName: `${guest.title} ${guest.lastName}`.trim(),
      priority: d.priority,
      status: 'new',
      createdAt: stamp(s),
      notes: [],
      escalationLevel: 0,
      originalMessage: original,
      language: lang,
      kind: d.kind,
      payload: d.payload,
    };
    s.tickets.push(t);
    created.push(t);
  }
  return created;
}

function guestItemName(t: Ticket, lang: 'en' | 'ar'): string {
  if (lang === 'en') return t.item;
  const item = t.itemKey ? ITEM_BY_KEY[t.itemKey] : undefined;
  if (item) return item.ar;
  const map: Record<string, string> = {
    'In-room dining order': 'طلب الطعام',
    'Table reservation': 'حجز الطاولة',
    'Spa booking': 'حجز السبا',
    'Guest question to answer': 'سؤالك',
    'Guest complaint': 'ملاحظتك',
  };
  return map[t.item] ?? t.item;
}

// --------------------------------------------------------------- sign-in

const norm = (v: string) =>
  v
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, '');

/** Today's date in the hotel's time zone (UAE, UTC+4), as YYYY-MM-DD. */
function hotelToday(s: State) {
  return new Date(stamp(s) + 4 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Finds an in-house stay by room number and surname, as the front office would.
 * Room numbers ignore leading zeros; surnames ignore case, spaces and accents.
 */
export function findStay(room: string, surname: string): Guest | undefined {
  const r = room.trim().replace(/^0+/, '');
  const n = norm(surname);
  if (!r || !n) return undefined;
  const today = hotelToday(state);
  return state.guests.find(
    (g) =>
      !g.checkedOutAt &&
      g.room.replace(/^0+/, '') === r &&
      norm(g.lastName) === n &&
      g.arrival <= today &&
      today <= g.departure,
  );
}

/** Opens (or resumes) the guest's conversation, with a welcome message the first time. */
export function signInGuest(guestId: string, lang: 'en' | 'ar') {
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    const { guest, conv } = p;
    conv.lang = lang;
    const first = !conv.signedInAt;
    conv.signedInAt = stamp(s);
    if (first)
      pushMessage(s, conv, {
        sender: 'ai',
        lang,
        text: tr(
          lang,
          `Welcome to Rixos Bab Al Bahr, ${guest.firstName}. I'm your AI concierge for room ${guest.room}. Ask me anything in your own words, or tap Services. Your ambassador, ${guest.ambassador}, is always one tap away.`,
          `أهلاً بك في ريكسوس باب البحر يا ${guest.firstName}. أنا مساعد الكونسيرج الذكي لغرفتك ${guest.room}. اطلب ما تشاء بكلماتك، أو اختر من الخدمات. ${guest.ambassador} من فريق سفراء التجربة متاح دائماً بضغطة واحدة.`,
        ),
        chips:
          lang === 'ar'
            ? ['مناشف إضافية', 'طلب طعام', 'حجز طاولة', 'ساعات المسبح']
            : ['Extra towels', 'Order food', 'Book a table', 'Pool hours'],
      });
  });
}

// ------------------------------------------------------------- guest flow

function applyEngine(
  s: State,
  guest: Guest,
  conv: Conversation,
  r: EngineResult,
  original: string,
) {
  const created = createTickets(s, guest, r.drafts, original, r.lang);
  const ids = created.map((t) => t.id);
  let usedIds = false;
  const fill = (cards?: Card[]) =>
    cards
      ?.map((c) => {
        if (c.type === 'tickets' && c.ticketIds.includes(NEW_TICKETS)) {
          usedIds = true;
          return { ...c, ticketIds: c.ticketIds.flatMap((x) => (x === NEW_TICKETS ? ids : [x])) };
        }
        return c;
      })
      .filter((c) => c.type !== 'tickets' || c.ticketIds.length > 0);

  let pendingCardMsg: string | undefined;
  r.replies.forEach((rep: Reply) => {
    const m = pushMessage(s, conv, {
      sender: 'ai',
      text: rep.text,
      lang: r.lang,
      cards: fill(rep.cards),
      chips: rep.chips,
    });
    if (
      rep.cards?.some(
        (c) => (c.type === 'order_confirm' || c.type === 'booking') && c.state === 'pending',
      )
    )
      pendingCardMsg = m.id;
  });
  if (!usedIds && ids.length)
    pushMessage(s, conv, {
      sender: 'ai',
      text: '',
      lang: r.lang,
      cards: [{ type: 'tickets', ticketIds: ids }],
    });

  if (r.completeCardMessageId) completeCard(s, r.completeCardMessageId);
  if (r.pending === null) delete conv.pending;
  else if (r.pending) {
    const p = { ...r.pending };
    if ((p.type === 'order_confirm' || p.type === 'booking') && !p.messageId)
      p.messageId = pendingCardMsg;
    conv.pending = p;
  }
  if (r.handover && conv.mode === 'ai')
    requestPerson(s, guest, conv, r.handover.reason, r.handover.urgency);
  return created;
}

/** Tells the guest a person is coming and flags the chat for staff. */
function requestPerson(
  s: State,
  guest: Guest,
  conv: Conversation,
  reason: string,
  urgency: Ticket['priority'],
) {
  const already = !!conv.handoverRequested;
  conv.handoverRequested = { reason, at: stamp(s), urgency };
  if (already) return;
  pushMessage(s, conv, {
    sender: 'system',
    text: tr(
      conv.lang,
      `${guest.ambassador}, your Experience Ambassador, has been notified and will join this chat.`,
      `تم إبلاغ ${guest.ambassador} من فريق سفراء التجربة وسينضم إلى هذه المحادثة.`,
    ),
    lang: conv.lang,
    cards: [{ type: 'handover', staffName: guest.ambassador }],
  });
}

function completeCard(s: State, messageId: string) {
  const m = s.messages.find((x) => x.id === messageId);
  m?.cards?.forEach((c) => {
    if (c.type === 'order_confirm') c.state = 'placed';
    if (c.type === 'booking') c.state = 'done';
  });
}

function engineCtx(guestId: string) {
  const guest = guestById(state, guestId)!;
  const conv = conversationOf(state, guestId) ?? {
    id: conversationId(guestId),
    guestId,
    mode: 'ai' as const,
    lang: 'en' as const,
  };
  return {
    guest,
    conversation: conv,
    tickets: state.tickets.filter((t) => t.guestId === guestId && !t.sample),
    knowledge: state.settings.knowledge,
    uiLang: conv.lang,
  };
}

const THINK_MS = { min: 650, max: 1200 };

/** Sends a guest message. The concierge "thinks" briefly, then replies with streamed text. */
export function sendGuestMessage(
  guestId: string,
  raw: string,
  opts: { thinkMs?: number } = {},
): Promise<void> {
  const text = raw.trim().slice(0, 1000);
  if (!text || !guestById(state, guestId)) return Promise.resolve();
  const { text: masked } = maskPii(text);
  const current = conversationOf(state, guestId);
  const lang = /[؀-ۿ]/.test(text) ? 'ar' : /\p{L}{2,}/u.test(text) ? 'en' : (current?.lang ?? 'en');
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    pushMessage(s, p.conv, { sender: 'guest', text: masked, lang });
    p.conv.lang = lang;
    p.conv.lastGuestAt = stamp(s);
    if (p.conv.mode === 'ai') p.conv.typing = true;
  });

  if (conversationOf(state, guestId)?.mode === 'human') {
    // A person is handling the chat: the concierge stays quiet, except for safety.
    const r = respond(text, engineCtx(guestId));
    if (r.emergency || r.pii.length) {
      let created: Ticket[] = [];
      update((s) => {
        const p = party(s, guestId);
        if (!p) return;
        created = applyEngine(
          s,
          p.guest,
          p.conv,
          {
            ...r,
            handover: undefined,
            replies: r.replies.filter((x) =>
              x.cards?.some((c) => c.type === 'emergency' || c.type === 'privacy'),
            ),
          },
          masked,
        );
      });
      emitCreated(created);
    }
    return Promise.resolve();
  }

  const delay = opts.thinkMs ?? THINK_MS.min + Math.random() * (THINK_MS.max - THINK_MS.min);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      let created: Ticket[] = [];
      try {
        // If a person took over while the concierge was thinking, stay quiet.
        if (conversationOf(state, guestId)?.mode === 'human') {
          update((s) => {
            const c = conversationOf(s, guestId);
            if (c) c.typing = false;
          });
          resolve();
          return;
        }
        const r = respond(text, engineCtx(guestId));
        update((s) => {
          const p = party(s, guestId);
          if (!p) return;
          p.conv.typing = false;
          created = applyEngine(s, p.guest, p.conv, r, masked);
        });
      } catch (err) {
        console.error(err);
        update((s) => {
          const p = party(s, guestId);
          if (!p) return;
          p.conv.typing = false;
          pushMessage(s, p.conv, {
            sender: 'ai',
            text: tr(
              p.conv.lang,
              "I'm sorry, I couldn't process that just now. I've asked your ambassador to help you personally.",
              'عذراً، لم أتمكن من معالجة ذلك الآن. طلبت من السفير مساعدتك شخصياً.',
            ),
            lang: p.conv.lang,
          });
          requestPerson(s, p.guest, p.conv, 'Concierge error fallback', 'high');
          createTickets(
            s,
            p.guest,
            [
              {
                department: 'frontoffice',
                category: 'Guest Relations',
                item: 'Concierge could not respond',
                details: 'Automatic fallback: please contact the guest.',
                priority: 'high',
                kind: 'handover',
              },
            ],
            masked,
            lang,
          );
        });
      }
      emitCreated(created);
      resolve();
    }, delay);
  });
}

export function setGuestLanguage(guestId: string, lang: 'en' | 'ar') {
  update((s) => {
    const p = party(s, guestId);
    if (p) p.conv.lang = lang;
  });
}

/** Menu card → read the order back and wait for a yes. */
export function reviewOrder(guestId: string, order: DiningOrder) {
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    const lang = p.conv.lang;
    const m = pushMessage(s, p.conv, {
      sender: 'ai',
      text: orderReadBack(order, s.settings.knowledge, lang),
      lang,
      cards: [{ type: 'order_confirm', order, state: 'pending' }],
      chips: lang === 'ar' ? ['نعم', 'تعديل'] : ['Yes, place it', 'Change'],
    });
    p.conv.pending = { type: 'order_confirm', order, messageId: m.id, lang };
  });
}

/** Order card "Place order" button. */
export function confirmOrder(guestId: string, messageId: string) {
  let created: Ticket[] = [];
  update((s) => {
    const p = party(s, guestId);
    const m = s.messages.find((x) => x.id === messageId);
    const card = m?.cards?.find((c) => c.type === 'order_confirm');
    if (!p || !card || card.type !== 'order_confirm' || card.state !== 'pending') return;
    const { guest, conv } = p;
    const lang = conv.lang;
    pushMessage(s, conv, {
      sender: 'guest',
      text: tr(lang, 'Yes, place my order', 'نعم، أكد الطلب'),
      lang,
    });
    created = createTickets(s, guest, [orderDraft(card.order)], undefined, lang);
    card.state = 'placed';
    delete conv.pending;
    pushMessage(s, conv, {
      sender: 'ai',
      text: tr(
        lang,
        `Your order is placed, ${guest.firstName}. I'll let you know when it's on the way. It will be charged to room ${guest.room} (${guest.lastName}).`,
        `تم تأكيد طلبك يا ${guest.firstName}، وسأبلغك عندما يكون في الطريق. سيُضاف إلى حساب الغرفة ${guest.room}.`,
      ),
      lang,
      cards: [{ type: 'tickets', ticketIds: created.map((t) => t.id) }],
    });
  });
  emitCreated(created);
}

/** Booking card submit (restaurant, spa or transport). */
export function submitBooking(guestId: string, messageId: string, booking: BookingDraft) {
  let created: Ticket[] = [];
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    const lang = p.conv.lang;
    created = createTickets(
      s,
      p.guest,
      [bookingDraftToTicket(booking, s.settings.knowledge)],
      undefined,
      lang,
    );
    if (!created.length) return;
    s.messages
      .find((x) => x.id === messageId)
      ?.cards?.forEach((c) => {
        if (c.type === 'booking') {
          c.state = 'done';
          c.booking = booking;
        }
      });
    if (p.conv.pending?.type === 'booking') delete p.conv.pending;
    pushMessage(s, p.conv, {
      sender: 'ai',
      text: bookingConfirmation(booking, s.settings.knowledge, lang),
      lang,
      cards: [{ type: 'tickets', ticketIds: created.map((t) => t.id) }],
    });
  });
  emitCreated(created);
  return created.length > 0;
}

/** Services grid: a direct request without typing. */
export function requestFromGrid(
  guestId: string,
  itemKey: string,
  opts: { quantity?: number; time?: string; notes?: string },
) {
  const item = ITEM_BY_KEY[itemKey];
  if (!item) return;
  let created: Ticket[] = [];
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    const lang = p.conv.lang;
    const label = lang === 'ar' ? item.ar : item.en;
    pushMessage(s, p.conv, {
      sender: 'guest',
      text: `${opts.quantity && opts.quantity > 1 ? `${opts.quantity} × ` : ''}${label}${opts.time ? ` · ${opts.time}` : ''}`,
      lang,
    });
    p.conv.lastGuestAt = stamp(s);
    created = createTickets(
      s,
      p.guest,
      [
        {
          department: item.dept,
          alsoNotify: item.also,
          category: item.en,
          item: item.en,
          itemKey: item.key,
          quantity: opts.quantity,
          details: opts.notes ? maskPii(opts.notes).text : undefined,
          preferredTime: opts.time,
          priority: item.prio ?? 'normal',
          kind: item.action === 'handover' ? 'handover' : 'service',
        },
      ],
      undefined,
      lang,
    );
    pushMessage(s, p.conv, {
      sender: 'ai',
      text: tr(
        lang,
        `Of course, ${p.guest.firstName}. I've sent this to our ${deptName(item.dept)} team.`,
        `بالتأكيد يا ${p.guest.firstName}. أرسلت طلبك إلى فريق ${deptName(item.dept, 'ar')}.`,
      ),
      lang,
      cards: [{ type: 'tickets', ticketIds: created.map((t) => t.id) }],
    });
  });
  emitCreated(created);
}

export function requestAmbassador(guestId: string) {
  const lang = conversationOf(state, guestId)?.lang ?? 'en';
  return sendGuestMessage(
    guestId,
    tr(lang, "I'd like to speak to my ambassador, please.", 'أود التحدث إلى السفير من فضلك.'),
  );
}

/** Services grid → booking picker card in the chat. */
export function startBooking(
  guestId: string,
  kind: BookingDraft['kind'],
  label: string,
  context?: string,
) {
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    const lang = p.conv.lang;
    pushMessage(s, p.conv, { sender: 'guest', text: label, lang });
    const booking: BookingDraft = { kind };
    if (kind === 'transport') {
      booking.outlet = context === 'airport' ? 'airport_departure' : (context ?? 'taxi');
      if (context === 'airport') booking.destination = 'Airport';
    }
    if (kind === 'spa' && context === 'couples') booking.outlet = 'couples';
    if (context === 'beach or terrace table') booking.notes = 'Beach or terrace table';
    const m = pushMessage(s, p.conv, {
      sender: 'ai',
      text: tr(
        lang,
        'Of course. Choose the details below and I will send the request to our team.',
        'بالتأكيد. اختر التفاصيل أدناه وسأرسل الطلب إلى فريقنا.',
      ),
      lang,
      cards: [{ type: 'booking', booking, state: 'pending' }],
    });
    p.conv.pending = {
      type: 'booking',
      booking,
      asking: kind === 'spa' ? 'outlet' : 'time',
      messageId: m.id,
      lang,
    };
  });
}

// ---------------------------------------------------------------- staff

function statusMessage(s: State, t: Ticket, status: TicketStatus, by: string) {
  const guest = guestById(s, t.guestId);
  const conv = guest && conversationOf(s, guest.id);
  if (!guest || !conv) return; // guest never opened the app: nothing to tell them in chat
  const lang = conv.lang;
  const name = guestItemName(t, lang);
  const dept = deptName(t.department, lang);
  if (status === 'accepted')
    pushMessage(s, conv, {
      sender: 'system',
      text: tr(
        lang,
        `${dept} has accepted your request: ${name}.`,
        `قبل فريق ${dept} طلبك: ${name}.`,
      ),
      lang,
      cards: [{ type: 'tickets', ticketIds: [t.id] }],
    });
  if (status === 'on_the_way')
    pushMessage(s, conv, {
      sender: 'system',
      text: tr(
        lang,
        `${by} is on the way with your ${name.toLowerCase()}.`,
        `${by} في الطريق إليك بطلبك: ${name}.`,
      ),
      lang,
    });
  if (status === 'done' && t.kind !== 'handover' && t.kind !== 'recovery')
    pushMessage(s, conv, {
      sender: 'ai',
      text: tr(
        lang,
        `Your request “${name}” is complete, ${guest.firstName}. How did we do?`,
        `اكتمل طلبك «${name}» يا ${guest.firstName}. كيف كانت الخدمة؟`,
      ),
      lang,
      cards: [{ type: 'rating', ticketId: t.id }],
    });
}

export function setTicketStatus(id: string, status: TicketStatus, by?: string) {
  update((s) => {
    const t = s.tickets.find((x) => x.id === id);
    if (!t || t.status === status || t.status === 'done' || t.status === 'cancelled') return;
    const at = stamp(s);
    const who = by ?? DEPT_BY_ID[t.department].staff;
    if (status === 'accepted') {
      t.acceptedAt = at;
      t.assignee = who;
    }
    if (status === 'on_the_way') {
      t.acceptedAt ??= at;
      t.assignee ??= who;
      t.onTheWayAt = at;
    }
    if (status === 'done') {
      t.acceptedAt ??= at;
      t.assignee ??= who;
      t.doneAt = at;
    }
    if (status === 'cancelled') t.cancelledAt = at;
    t.status = status;
    t.notes.push({ at, by: who, text: `Status → ${status.replace(/_/g, ' ')}` });
    statusMessage(s, t, status, who);
    // Closing the last person-needed ticket clears the "waiting for a person" flag.
    if (status === 'done' && (t.kind === 'handover' || t.kind === 'recovery')) {
      const conv = conversationOf(s, t.guestId);
      const stillOpen = s.tickets.some(
        (x) =>
          x.guestId === t.guestId &&
          (x.kind === 'handover' || x.kind === 'recovery') &&
          x.status !== 'done' &&
          x.status !== 'cancelled',
      );
      if (conv && !stillOpen) delete conv.handoverRequested;
    }
  });
}

export function cancelTicket(id: string) {
  setTicketStatus(id, 'cancelled', 'Guest');
}

export function reassignTicket(id: string, dept: DepartmentId, by: string) {
  update((s) => {
    const t = s.tickets.find((x) => x.id === id);
    if (!t) return;
    const at = stamp(s);
    t.notes.push({
      at,
      by,
      text: `Reassigned from ${deptName(t.department)} to ${deptName(dept)}`,
    });
    t.department = dept;
    t.createdAt = at; // the new team gets a fresh response clock
    t.escalationLevel = 0;
    t.status = 'new';
    delete t.acceptedAt;
    delete t.assignee;
  });
}

export function addNote(id: string, by: string, text: string) {
  const clean = maskPii(text.trim().slice(0, 500)).text;
  if (!clean) return;
  update((s) => {
    s.tickets.find((x) => x.id === id)?.notes.push({ at: stamp(s), by, text: clean });
  });
}

function joinChat(s: State, conv: Conversation, staffName: string, dept: DepartmentId) {
  if (conv.mode === 'human' && conv.humanName === staffName) return;
  pushMessage(s, conv, {
    sender: 'system',
    text: tr(
      conv.lang,
      `${staffName} (${deptName(dept)}) has joined the chat. You are now talking to a person.`,
      `انضم ${staffName} (${deptName(dept, 'ar')}) إلى المحادثة. أنت الآن تتحدث مع موظف.`,
    ),
    lang: conv.lang,
  });
  conv.mode = 'human';
  conv.humanName = staffName;
  conv.typing = false;
  delete conv.handoverRequested;
  delete conv.pending;
}

/** A staff member takes the chat over from the AI without writing yet. */
export function takeOverChat(guestId: string, staffName: string, dept: DepartmentId) {
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    joinChat(s, p.conv, staffName, dept);
    p.conv.staffReadAt = stamp(s);
  });
}

/** A staff member replies in the guest chat, taking it over from the AI if needed. */
export function staffReply(guestId: string, text: string, staffName: string, dept: DepartmentId) {
  const clean = maskPii(text.trim().slice(0, 1000)).text;
  if (!clean) return;
  update((s) => {
    const p = party(s, guestId);
    if (!p) return;
    joinChat(s, p.conv, staffName, dept);
    pushMessage(s, p.conv, {
      sender: 'staff',
      staffName: `${staffName} · ${DEPT_BY_ID[dept].short}`,
      text: clean,
      lang: p.conv.lang,
    });
    p.conv.staffReadAt = stamp(s);
  });
}

export function handBackToAi(guestId: string) {
  update((s) => {
    const conv = conversationOf(s, guestId);
    if (!conv || conv.mode === 'ai') return;
    conv.mode = 'ai';
    delete conv.humanName;
    delete conv.handoverRequested;
    conv.staffReadAt = stamp(s);
    pushMessage(s, conv, {
      sender: 'system',
      text: tr(
        conv.lang,
        'The AI concierge is replying again. Your ambassador is always one tap away.',
        'عاد مساعد الكونسيرج الذكي للرد. السفير متاح دائماً بضغطة واحدة.',
      ),
      lang: conv.lang,
    });
  });
}

/** Staff opened the chat: clears its unread count on every device. */
export function markChatRead(guestId: string) {
  const conv = conversationOf(state, guestId);
  if (!conv || (conv.staffReadAt ?? 0) >= (conv.lastGuestAt ?? 0)) return;
  update((s) => {
    const c = conversationOf(s, guestId);
    if (c) c.staffReadAt = stamp(s);
  });
}

export function rateTicket(ticketId: string, value: number) {
  let created: Ticket[] = [];
  update((s) => {
    const t = s.tickets.find((x) => x.id === ticketId);
    if (!t || t.rating) return;
    const p = party(s, t.guestId);
    t.rating = value;
    s.ratings.push({ ticketId, value, at: stamp(s) });
    s.messages.forEach((m) =>
      m.cards?.forEach((c) => c.type === 'rating' && c.ticketId === ticketId && (c.value = value)),
    );
    if (!p) return;
    const { guest, conv } = p;
    const lang = conv.lang;
    conv.lastGuestAt = stamp(s);
    if (value <= 2) {
      created = createTickets(
        s,
        guest,
        [
          {
            department: 'frontoffice',
            category: 'Service Recovery',
            item: 'Service recovery',
            details: `Guest rated “${t.item}” (${t.id}, ${deptName(t.department)}) ${value}/5. Contact the guest personally.`,
            priority: 'high',
            kind: 'recovery',
          },
        ],
        undefined,
        lang,
      );
      pushMessage(s, conv, {
        sender: 'ai',
        text: tr(
          lang,
          `I'm very sorry we fell short, ${guest.firstName}. Your ambassador, ${guest.ambassador}, will contact you personally to put this right.`,
          `نأسف جداً لأننا لم نكن عند حسن ظنك يا ${guest.firstName}. سيتواصل معك ${guest.ambassador} من فريق سفراء التجربة شخصياً لمعالجة الأمر.`,
        ),
        lang,
        cards: [{ type: 'tickets', ticketIds: created.map((x) => x.id) }],
      });
      if (conv.mode === 'ai') requestPerson(s, guest, conv, `Low rating (${value}/5)`, 'high');
    } else {
      pushMessage(s, conv, {
        sender: 'ai',
        text: tr(
          lang,
          `Thank you, ${guest.firstName}. We're delighted to hear it.`,
          `شكراً لك يا ${guest.firstName}. يسعدنا ذلك.`,
        ),
        lang,
      });
    }
  });
  emitCreated(created);
}

// ------------------------------------------------------------- in-house guests

export type NewGuest = Omit<Guest, 'id' | 'sample' | 'checkedOutAt'>;

export function addGuest(g: NewGuest): string {
  const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  update((s) => {
    s.guests.push({
      ...g,
      id,
      title: g.title.trim(),
      firstName: g.firstName.trim(),
      lastName: g.lastName.trim(),
      room: g.room.trim(),
      ambassador: g.ambassador.trim() || 'Nadia',
    });
  });
  return id;
}

/** Checks a guest out: they can no longer sign in, and any open chat closes. */
export function checkOutGuest(guestId: string) {
  update((s) => {
    const g = guestById(s, guestId);
    if (!g || g.checkedOutAt) return;
    g.checkedOutAt = stamp(s);
    const conv = conversationOf(s, guestId);
    if (conv) {
      conv.mode = 'ai';
      delete conv.humanName;
      delete conv.handoverRequested;
      delete conv.pending;
      conv.typing = false;
    }
  });
}

export function reinstateGuest(guestId: string) {
  update((s) => {
    const g = guestById(s, guestId);
    if (g) delete g.checkedOutAt;
  });
}

// ------------------------------------------------------------- escalation

let leader = typeof navigator === 'undefined' || !('locks' in navigator);
if (!leader) {
  // One tab at a time runs the escalation clock; the lock passes on when that tab closes.
  void navigator.locks.request('rixos-concierge-leader', () => {
    leader = true;
    return new Promise<void>(() => {});
  });
}

/** Raises escalation levels as time passes. Only the leader tab writes, so tabs never race. */
export function tickEscalations() {
  if (!leader) return;
  const t = now();
  const changes = state.tickets.filter(
    (x) => !x.sample && computeEscalation(x, state.settings.standards, t) > x.escalationLevel,
  );
  if (!changes.length) return;
  update((s) => {
    for (const c of changes) {
      const tk = s.tickets.find((x) => x.id === c.id);
      if (!tk) continue;
      const level = computeEscalation(tk, s.settings.standards, t);
      if (level <= tk.escalationLevel) continue;
      tk.escalationLevel = level;
      tk.notes.push({
        at: t,
        by: 'System',
        text: `${escalationLabel(level)} (${level === 1 ? DEPT_BY_ID[tk.department].supervisor : 'Duty Manager'})`,
      });
    }
  });
}

// ---------------------------------------------------------------- admin

export function setStandards(standards: Standards) {
  update((s) => {
    s.settings.standards = standards;
  });
}

export function setKnowledge(knowledge: Knowledge) {
  update((s) => {
    s.settings.knowledge = knowledge;
  });
}

export function advanceClock(minutes: number) {
  update((s) => {
    s.clockOffset += minutes * 60_000;
  });
  tickEscalations();
}

/** Clears chats, tickets and ratings. Settings and the in-house list are kept unless asked. */
export function resetDemo(opts: { keepSettings?: boolean; keepGuests?: boolean } = {}) {
  const fresh = initialState();
  update((s) => {
    const settings = s.settings;
    const guests = s.guests.filter((g) => !g.sample);
    Object.assign(s, fresh, { rev: s.rev, writer: s.writer });
    if (opts.keepSettings) s.settings = settings;
    if (opts.keepGuests !== false) s.guests = [...fresh.guests, ...guests];
  });
}
