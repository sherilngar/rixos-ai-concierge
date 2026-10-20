import { CATALOGUE, ITEM_BY_KEY, type CatalogueItem } from '../domain/catalogue';
import { maskPii, type PiiKind } from '../domain/pii';
import type {
  BookingDraft,
  BookingField,
  Card,
  Conversation,
  DiningItem,
  DiningOrder,
  Guest,
  Lang,
  PendingState,
  Priority,
  Ticket,
  TicketDraft,
} from '../domain/types';
import { menuItems, type Knowledge } from '../data/knowledge';
import { KB_TOPICS, outletTopics, type KbTopic } from './kb';
import {
  containsAny,
  detectLang,
  findKeyword,
  findMatches,
  hasProblemMarker,
  hasRequestMarker,
  isAffirmative,
  isNegative,
  isQuestion,
  normalize,
  parsePartySize,
  parseTime,
  quantityNear,
  splitSegments,
  wordToNumber,
  type Match,
} from './text';

/**
 * Offline concierge. A deterministic engine that reads free text in English or
 * Arabic and produces the same effects the live Claude tools would: tickets,
 * bookings, dining orders, hand-offs and knowledge-base answers. It never
 * invents facts: anything not in the knowledge base goes to the ambassador.
 */

export interface EngineContext {
  guest: Guest;
  conversation: Conversation;
  tickets: Ticket[];
  knowledge: Knowledge;
  uiLang: 'en' | 'ar';
}

export interface Reply {
  text: string;
  cards?: Card[];
  chips?: string[];
}

export interface EngineResult {
  lang: Lang;
  maskedText: string;
  pii: PiiKind[];
  replies: Reply[];
  drafts: TicketDraft[];
  cancel: string[];
  /** undefined = leave as is, null = clear. */
  pending?: PendingState | null;
  handover?: { reason: string; urgency: Priority };
  emergency?: boolean;
  /** Mark the pending order or booking card as completed. */
  completeCardMessageId?: string;
}

/** Placeholder replaced by the store with the ids of the tickets it creates. */
export const NEW_TICKETS = '__NEW__';

type L = 'en' | 'ar';
const tr = (lang: L, en: string, ar: string) => (lang === 'ar' ? ar : en);

const INJECTION = [
  'ignore previous',
  'ignore all previous',
  'ignore your instructions',
  'ignore the rules',
  'disregard your',
  'disregard all',
  'system prompt',
  'you are now',
  'pretend to be',
  'pretend you are',
  'act as if',
  'developer mode',
  'jailbreak',
  'new instructions',
  'reveal your prompt',
  'تجاهل التعليمات',
  'تجاهل كل',
  'انت الان',
];
const EMERGENCY = [
  'emergency',
  'fire',
  'there is smoke',
  'smell smoke',
  'smoke in',
  'smoke alarm',
  "can't breathe",
  'cannot breathe',
  'not breathing',
  'unconscious',
  'heart attack',
  'chest pain',
  'ambulance',
  'call 999',
  'call 998',
  'help me',
  'drowning',
  'حريق',
  'دخان',
  'طوارئ',
  'طارئ',
  'اسعاف',
  'لا يتنفس',
  'ما يتنفس',
  'نوبه قلبيه',
  'الم في الصدر',
  'ساعدوني',
  'غرق',
];
const COMPLAINT = [
  'complaint',
  'complain',
  'unacceptable',
  'disgusting',
  'terrible',
  'awful',
  'horrible',
  'worst',
  'disappointed',
  'disappointing',
  'not happy',
  'unhappy',
  'angry',
  'furious',
  'rude',
  'ridiculous',
  'very bad',
  'so bad',
  'still waiting',
  'nobody came',
  'no one came',
  'شكوى',
  'اشتكي',
  'سيء',
  'سيئ',
  'زعلان',
  'غير مقبول',
  'مستاء',
  'محد جا',
  'ما احد جا',
  'متضايق',
];
const REFUND = [
  'refund',
  'compensation',
  'money back',
  'discount',
  'charge me less',
  'استرجاع',
  'تعويض',
  'استرداد',
  'خصم',
];
const OTHER_GUEST = [
  'another guest',
  'other guest',
  'the guest in room',
  'guest next door',
  'neighbour',
  'neighbor',
  'next door',
  'room next to',
  'نزيل اخر',
  'الجيران',
  'الغرفه المجاوره',
];
const CANCEL = [
  'cancel',
  'cancel my',
  "don't need",
  'no longer need',
  'الغاء',
  'الغي',
  'ما ابي',
  'ما ابغي',
];
const STATUS = [
  'my requests',
  'status of my',
  'request status',
  'any update',
  'update on my',
  'how long',
  'is it coming',
  'طلباتي',
  'حاله طلباتي',
  'حاله الطلب',
  'متي يوصل',
  'وين وصل',
];
const GREETING =
  /^(hi|hello|hey|good (morning|afternoon|evening)|salam|مرحبا|السلام عليكم|اهلا|هلا|صباح الخير|مساء الخير)(?=$|[^\p{L}\p{N}])/u;
const THANKS =
  /^(thanks|thank you|thx|cheers|great,? thanks|perfect,? thanks|شكرا|مشكور|يعطيك العافيه|تسلم)/;

export const DEFAULT_CHIPS: Record<L, string[]> = {
  en: ['Extra towels', 'Order food', 'Book a table', 'Spa treatment', 'Pool hours', 'My requests'],
  ar: ['مناشف إضافية', 'طلب طعام', 'حجز طاولة', 'جلسة سبا', 'ساعات المسبح', 'طلباتي'],
};

const ALLERGENS: Array<[RegExp, string]> = [
  [/\b(peanuts?)\b|فول سوداني/, 'peanuts'],
  [/\b(nuts?|tree nuts?)\b|مكسرات/, 'nuts'],
  [/\b(dairy|lactose|milk)\b|البان|حليب|لاكتوز/, 'dairy'],
  [/\b(gluten|wheat|coeliac|celiac)\b|جلوتين|غلوتين|قمح/, 'gluten'],
  [/\b(eggs?)\b|بيض/, 'egg'],
  [/\b(shellfish|prawns?|shrimp)\b|قشريات|روبيان|جمبري/, 'shellfish'],
  [/\b(sesame)\b|سمسم/, 'sesame'],
  [/\b(fish)\b|سمك/, 'fish'],
];

function detectAllergies(text: string): string[] {
  const allergyContext =
    /allerg|intoleran|\bno (nuts?|peanuts?|dairy|gluten|eggs?|shellfish|sesame)|without (nuts?|dairy|gluten|eggs?)|(nut|dairy|gluten|egg)[- ]free|حساسيه|بدون (مكسرات|حليب|جلوتين|غلوتين|بيض)/.test(
      text,
    );
  if (!allergyContext) return [];
  return ALLERGENS.filter(([re]) => re.test(text))
    .map(([, name]) => name)
    .filter(
      (v, i, a) =>
        a.indexOf(v) === i && !(v === 'nuts' && a.includes('peanuts') && !/\bnuts\b/.test(text)),
    );
}

function fmtTime(time: string | undefined, date: string | undefined, lang: L): string {
  const d =
    date === 'tomorrow'
      ? tr(lang, 'tomorrow', 'غداً')
      : date === 'today'
        ? tr(lang, 'today', 'اليوم')
        : '';
  if (!time) return d;
  const t =
    time === 'now'
      ? tr(lang, 'now', 'الآن')
      : time.startsWith('in ')
        ? tr(lang, time, `بعد ${time.slice(3).replace('min', 'دقيقة')}`)
        : time;
  return d ? `${d} ${tr(lang, 'at', 'الساعة')} ${t}` : t;
}

function itemName(item: CatalogueItem, lang: L) {
  return lang === 'ar' ? item.ar : item.en;
}

function sectionName(item: CatalogueItem): string {
  return CATALOGUE.find((s) => s.items.includes(item))?.en ?? item.dept;
}

function draftFromItem(
  item: CatalogueItem,
  opts: { quantity?: number; details?: string; preferredTime?: string; priority?: Priority },
): TicketDraft {
  return {
    department: item.dept,
    alsoNotify: item.also,
    category: sectionName(item),
    item: item.en,
    itemKey: item.key,
    quantity: opts.quantity,
    details: opts.details,
    preferredTime: opts.preferredTime,
    priority: opts.priority ?? item.prio ?? 'normal',
    kind: item.action === 'handover' ? 'handover' : 'service',
  };
}

// ---------------------------------------------------------------- bookings

export function missingBookingField(b: BookingDraft): BookingField | undefined {
  if (b.kind === 'restaurant') {
    if (!b.outlet) return 'outlet';
    if (!b.date) return 'date';
    if (!b.time) return 'time';
    if (!b.partySize) return 'partySize';
  } else if (b.kind === 'spa') {
    if (!b.outlet) return 'outlet';
    if (!b.date) return 'date';
    if (!b.time) return 'time';
  } else {
    if (!b.date) return 'date';
    if (!b.time) return 'time';
    if (!b.destination) return 'destination';
    if (!b.partySize) return 'passengers';
  }
  return undefined;
}

function bookingQuestion(b: BookingDraft, field: BookingField, k: Knowledge, lang: L): Reply {
  switch (field) {
    case 'outlet':
      if (b.kind === 'spa')
        return {
          text: tr(lang, 'Which treatment would you like?', 'ما العلاج الذي تفضله؟'),
          chips: k.spa.treatments
            .slice(0, 4)
            .map((t) => (lang === 'ar' ? t.nameAr : t.name).split(' · ')[0] ?? t.name),
        };
      return {
        text: tr(lang, 'Which restaurant would you like?', 'أي مطعم تفضّل؟'),
        chips: k.outlets
          .filter((o) => o.reservations)
          .map((o) => (lang === 'ar' ? o.nameAr : o.name)),
      };
    case 'date':
      return {
        text: tr(lang, 'Which day would you like?', 'أي يوم تفضّل؟'),
        chips: lang === 'ar' ? ['اليوم', 'غداً'] : ['Today', 'Tomorrow'],
      };
    case 'time':
      return {
        text: tr(lang, 'What time would suit you?', 'ما الوقت المناسب لك؟'),
        chips:
          b.kind === 'restaurant'
            ? ['19:00', '19:30', '20:00', '20:30']
            : ['10:00', '14:00', '16:00', '18:00'],
      };
    case 'partySize':
      return {
        text: tr(lang, 'How many guests will be joining?', 'كم عدد الضيوف؟'),
        chips: ['1', '2', '3', '4', '5', '6'],
      };
    case 'passengers':
      return {
        text: tr(lang, 'How many passengers?', 'كم عدد الركاب؟'),
        chips: ['1', '2', '3', '4'],
      };
    case 'destination':
      return { text: tr(lang, 'Where would you like to go?', 'إلى أين تود الذهاب؟') };
  }
}

function resolveOutlet(text: string, k: Knowledge): string | undefined {
  const matches = findMatches(
    text,
    k.outlets.map((o) => ({ key: o.id, kw: [o.name, o.nameAr, ...o.kw] })),
  );
  const hit = matches.find((m) => k.outlets.find((o) => o.id === m.key)?.reservations);
  return hit?.key;
}

function resolveTreatment(text: string, k: Knowledge, context?: string): string | undefined {
  if (context === 'couples') return k.spa.treatments.find((t) => t.id === 'couples')?.id;
  const matches = findMatches(
    text,
    k.spa.treatments.map((t) => ({
      key: t.id,
      kw: [
        t.name.split(' · ')[0] ?? t.name,
        t.nameAr.split(' · ')[0] ?? t.nameAr,
        t.id === 'deeptissue' ? 'deep tissue' : t.id,
        t.id === 'hotstone' ? 'hot stone' : t.id,
      ],
    })),
  );
  return matches[0]?.key;
}

/** Merges whatever this message says into a booking draft. */
export function fillBooking(
  b: BookingDraft,
  raw: string,
  k: Knowledge,
  asking?: BookingField,
): BookingDraft {
  const text = normalize(raw);
  const next = { ...b };
  const pt = parseTime(raw);
  if (pt.date) next.date = pt.date;
  if (pt.time && pt.time !== 'now') next.time = pt.time;
  else if (pt.time === 'now' && b.kind === 'transport') {
    next.time = 'now';
    next.date = next.date ?? 'today';
  }
  if (!next.time && pt.bareHour !== undefined && b.kind === 'restaurant' && pt.date) {
    next.time = `${String(pt.bareHour < 12 ? pt.bareHour + 12 : pt.bareHour).padStart(2, '0')}:00`;
  }
  if (b.kind === 'restaurant') {
    next.outlet = resolveOutlet(text, k) ?? next.outlet;
    next.partySize = parsePartySize(raw) ?? next.partySize;
  }
  if (b.kind === 'spa') next.outlet = resolveTreatment(text, k) ?? next.outlet;
  if (b.kind === 'transport') {
    next.partySize = parsePartySize(raw) ?? next.partySize;
    const dest = text.match(
      /\bto (?:the )?([a-z][a-z\s]{2,40}?)(?:\s+(?:at|for|tomorrow|today|tonight|please)\b|[,.]|$)/,
    );
    if (dest && !/^(airport|hotel)$/.test(dest[1] ?? '')) next.destination = dest[1]?.trim();
  }
  // A bare answer to the question we just asked.
  const bare = text.match(/^(\d{1,2}|[\p{L}]+)(\s*(people|guests|pax|persons|اشخاص|شخص))?$/u);
  const n = bare ? wordToNumber(bare[1] ?? '') : undefined;
  if (asking && n !== undefined) {
    if (asking === 'partySize' || asking === 'passengers') next.partySize = n;
    if (asking === 'time')
      next.time = `${String(n <= 11 && b.kind === 'restaurant' ? n + 12 : n).padStart(2, '0')}:00`;
  }
  if (asking === 'destination' && !next.destination && text.length > 1 && n === undefined)
    next.destination = raw.trim();
  if (/^(today|اليوم)$/.test(text)) next.date = 'today';
  if (/^(tomorrow|غدا|بكره)$/.test(text)) next.date = 'tomorrow';
  return next;
}

export function bookingDraftToTicket(b: BookingDraft, k: Knowledge): TicketDraft {
  if (b.kind === 'restaurant') {
    const outlet = k.outlets.find((o) => o.id === b.outlet);
    return {
      department: 'restaurants',
      category: 'Restaurants & Bars',
      item: 'Table reservation',
      itemKey: 'book_table',
      quantity: b.partySize,
      details: [outlet?.name, `${b.date} ${b.time}`, `${b.partySize} guests`, b.occasion, b.notes]
        .filter(Boolean)
        .join(' · '),
      preferredTime: `${b.date} ${b.time}`,
      priority: 'normal',
      kind: 'reservation',
      payload: {
        outlet: outlet?.name ?? b.outlet,
        date: b.date,
        time: b.time,
        party_size: b.partySize,
        occasion: b.occasion,
        notes: b.notes,
      },
    };
  }
  if (b.kind === 'spa') {
    const t = k.spa.treatments.find((x) => x.id === b.outlet);
    return {
      department: 'spa',
      category: 'Spa & Wellness',
      item: 'Spa booking',
      itemKey: 'spa_book',
      details: [
        t?.name,
        `${b.date} ${b.time}`,
        b.therapist && b.therapist !== 'none' ? `${b.therapist} therapist preferred` : '',
        b.notes,
      ]
        .filter(Boolean)
        .join(' · '),
      preferredTime: `${b.date} ${b.time}`,
      priority: 'normal',
      kind: 'spa',
      payload: {
        treatment: t?.name ?? b.outlet,
        date: b.date,
        time: b.time,
        therapist_preference: b.therapist ?? 'none',
        notes: b.notes,
      },
    };
  }
  const type = b.outlet ?? 'taxi';
  const label: Record<string, string> = {
    airport_departure: 'Airport transfer (departure)',
    airport_arrival: 'Airport transfer (arrival)',
    taxi: 'Taxi',
    limousine: 'Limousine',
    chauffeur: 'Chauffeur',
  };
  return {
    department: 'concierge',
    category: 'Concierge & Transport',
    item: label[type] ?? 'Transport',
    itemKey: type.startsWith('airport') ? 'airport_transfer' : type,
    quantity: b.partySize,
    details: [
      `${b.pickup ?? 'Hotel main entrance'} → ${b.destination}`,
      `${b.date} ${b.time}`,
      `${b.partySize} passengers`,
      b.luggage ? `${b.luggage} bags` : '',
      b.notes,
    ]
      .filter(Boolean)
      .join(' · '),
    preferredTime: `${b.date} ${b.time}`,
    priority: 'normal',
    kind: 'transport',
    payload: {
      type,
      date: b.date,
      time: b.time,
      pickup: b.pickup ?? 'Hotel main entrance',
      destination: b.destination,
      passengers: b.partySize,
      luggage: b.luggage ?? 0,
    },
  };
}

export function bookingSummary(b: BookingDraft, k: Knowledge, lang: L): string {
  const when = fmtTime(b.time, b.date, lang);
  if (b.kind === 'restaurant') {
    const o = k.outlets.find((x) => x.id === b.outlet);
    return tr(
      lang,
      `a table at ${o?.name} ${when} for ${b.partySize}`,
      `طاولة في ${o?.nameAr} ${when} لـ ${b.partySize} أشخاص`,
    );
  }
  if (b.kind === 'spa') {
    const t = k.spa.treatments.find((x) => x.id === b.outlet);
    return tr(lang, `${t?.name ?? 'a treatment'} ${when}`, `${t?.nameAr ?? 'علاج'} ${when}`);
  }
  return tr(lang, `a car to ${b.destination} ${when}`, `سيارة إلى ${b.destination} ${when}`);
}

export function bookingConfirmation(b: BookingDraft, k: Knowledge, lang: L): string {
  const dept =
    b.kind === 'restaurant'
      ? tr(lang, 'restaurant', 'المطعم')
      : b.kind === 'spa'
        ? tr(lang, 'spa', 'السبا')
        : tr(lang, 'concierge', 'الكونسيرج');
  return tr(
    lang,
    `I've requested ${bookingSummary(b, k, lang)}. Our ${dept} team will confirm availability shortly, and I'll update you here.`,
    `طلبت لك ${bookingSummary(b, k, lang)}. سيؤكد فريق ${dept} التوفر قريباً، وسأبلغك هنا.`,
  );
}

// ------------------------------------------------------------------ dining

export function orderDraft(order: DiningOrder): TicketDraft {
  return {
    department: 'ird',
    category: 'In-Room Dining',
    item: 'In-room dining order',
    itemKey: 'ird_order',
    quantity: order.items.reduce((s, i) => s + i.qty, 0),
    details:
      order.items
        .map(
          (i) => `${i.qty} × ${i.name}${i.modifiers.length ? ` (${i.modifiers.join(', ')})` : ''}`,
        )
        .join('; ') + (order.allergies ? ` · ALLERGY: ${order.allergies}` : ''),
    preferredTime: order.deliveryTime ?? 'As soon as possible',
    priority: order.allergies ? 'high' : 'normal',
    kind: 'dining',
    payload: {
      items: order.items.map((i) => ({ name: i.name, qty: i.qty, modifiers: i.modifiers })),
      allergies: order.allergies,
      delivery_time: order.deliveryTime,
      notes: order.notes,
    },
  };
}

export function orderReadBack(order: DiningOrder, k: Knowledge, lang: L): string {
  const all = menuItems(k);
  const lines = order.items.map((i) => {
    const m = all.find((x) => x.id === i.id);
    const name = lang === 'ar' && m ? m.nameAr : i.name;
    return `• ${i.qty} × ${name}${i.modifiers.length ? ` (${i.modifiers.join(', ')})` : ''}`;
  });
  const warnings: string[] = [];
  if (order.allergies) {
    const allergens = order.allergies.split(/,\s*/);
    for (const i of order.items) {
      const m = all.find((x) => x.id === i.id);
      const hit = m?.contains.filter((c) =>
        allergens.some((a) => a.startsWith(c) || c.startsWith(a)),
      );
      if (m && hit?.length)
        warnings.push(
          tr(
            lang,
            `Please note: ${m.name} contains ${hit.join(', ')}. Our kitchen will call you to suggest an alternative.`,
            `تنبيه: ${m.nameAr} يحتوي على مكونات قد تسبب الحساسية. سيتصل بك المطبخ لاقتراح بديل.`,
          ),
        );
    }
  }
  return [
    tr(lang, 'Let me repeat your order:', 'دعني أكرر طلبك:'),
    ...lines,
    order.allergies
      ? tr(lang, `Allergies: ${order.allergies}`, `الحساسية: ${order.allergies}`)
      : '',
    tr(
      lang,
      `Delivery: ${order.deliveryTime && order.deliveryTime !== 'now' ? order.deliveryTime : 'as soon as possible'}`,
      `التوصيل: ${order.deliveryTime && order.deliveryTime !== 'now' ? order.deliveryTime : 'في أقرب وقت'}`,
    ),
    ...warnings,
    tr(
      lang,
      'Shall I place it? Please reply “yes” to confirm.',
      'هل أؤكد الطلب؟ يرجى الرد بـ «نعم» للتأكيد.',
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

// -------------------------------------------------------------------- core

export function respond(raw: string, ctx: EngineContext): EngineResult {
  const { text: masked, found } = maskPii(raw);
  const text = normalize(masked);
  const detected = detectLang(masked);
  const pendingLang = ctx.conversation.pending?.lang;
  const hasLetters = /\p{L}{2,}/u.test(masked);
  const lang: Lang = hasLetters ? detected : (pendingLang ?? ctx.uiLang);
  const L: L = lang === 'ar' ? 'ar' : 'en';
  const name = ctx.guest.firstName;
  const k = ctx.knowledge;

  const res: EngineResult = {
    lang,
    maskedText: masked,
    pii: found,
    replies: [],
    drafts: [],
    cancel: [],
  };
  const replies = res.replies;

  if (found.length) {
    replies.push({
      text: tr(
        L,
        'For your security I have hidden that number. Please never share card, passport or ID numbers in chat; our team will never ask for them here.',
        'حرصاً على أمانك أخفيت ذلك الرقم. يرجى عدم مشاركة أرقام البطاقات أو جواز السفر أو الهوية في المحادثة؛ لن يطلبها فريقنا هنا أبداً.',
      ),
      cards: [{ type: 'privacy' }],
    });
  }
  if (lang === 'other') {
    replies.push({
      text: 'This offline demo replies in English or Arabic. The live AI version answers in your own language.',
    });
  }

  // 1. Prompt injection: decline and do nothing else.
  if (containsAny(text, INJECTION)) {
    replies.push({
      text: tr(
        L,
        `I'm here to help with your stay, ${name}, and I can't change how I work. How may I help you today?`,
        `أنا هنا لخدمتك خلال إقامتك يا ${name}، ولا يمكنني تغيير طريقة عملي. كيف يمكنني مساعدتك اليوم؟`,
      ),
      chips: DEFAULT_CHIPS[L],
    });
    res.pending = null;
    return res;
  }

  // 2. Emergency: guidance first, people alerted immediately.
  if (containsAny(text, EMERGENCY)) {
    res.emergency = true;
    res.pending = null;
    const base = {
      category: 'Emergency',
      item: 'Guest emergency alert',
      priority: 'urgent' as const,
      kind: 'handover' as const,
      details: 'Guest reported an emergency in chat. Respond immediately.',
    };
    res.drafts.push({ ...base, department: 'security' }, { ...base, department: 'dutymanager' });
    res.handover = { reason: 'Emergency reported by guest', urgency: 'urgent' };
    replies.push({
      text: tr(
        L,
        `${name}, I have alerted Security and the Rooms Controller; they are on their way to room ${ctx.guest.room} now. Please follow the emergency instructions below.`,
        `${name}، أبلغت فريق الأمن ومراقب الغرف وهم في طريقهم إلى غرفتك ${ctx.guest.room} الآن. يرجى اتباع تعليمات الطوارئ أدناه.`,
      ),
      cards: [{ type: 'emergency' }, { type: 'tickets', ticketIds: [NEW_TICKETS] }],
    });
    return res;
  }

  // 3. Resolve a pending clarification.
  const pending = ctx.conversation.pending;
  if (pending) {
    const handled = resolvePending(raw, text, pending, ctx, res, L);
    if (handled) return res;
    res.pending = null;
  }

  // 4. Simple social turns.
  const segments = splitSegments(text);
  const catalogueEntries = CATALOGUE.flatMap((s) => s.items).map((i) => ({ key: i.key, kw: i.kw }));
  const menu = menuItems(k);
  const menuEntries = menu.map((m) => ({ key: `menu:${m.id}`, kw: [m.name, m.nameAr, ...m.kw] }));
  // Outlet names compete in the same pool so "Isla Beach Bar" is not read as "beach".
  const outletEntries = k.outlets.map((o) => ({
    key: `outlet:${o.id}`,
    kw: [o.name, o.nameAr, ...o.kw.filter((w) => w.split(' ').length > 1)],
  }));
  const entries = [...catalogueEntries, ...menuEntries, ...outletEntries];

  const segMatches: Array<{ seg: string; matches: Match[] }> = segments.map((s) => {
    let matches = findMatches(s.text, entries);
    const absorbed = new Set(matches.flatMap((m) => ITEM_BY_KEY[m.key]?.absorbs ?? []));
    matches = matches.filter((m) => !absorbed.has(m.key));
    return { seg: s.text, matches };
  });
  const allMatches = segMatches.flatMap((s) => s.matches);

  const complaint = containsAny(text, COMPLAINT);
  const refund = containsAny(text, REFUND);
  const otherGuest = containsAny(text, OTHER_GUEST);
  const wantsCancel = containsAny(text, CANCEL);
  const wantsStatus = containsAny(text, STATUS) && !wantsCancel;

  if (!allMatches.length && !complaint && !refund && !otherGuest && !wantsCancel && !wantsStatus) {
    if (THANKS.test(text)) {
      replies.push({
        text: tr(
          L,
          `It's my pleasure, ${name}. I'm here whenever you need anything.`,
          `بكل سرور يا ${name}. أنا هنا متى احتجت أي شيء.`,
        ),
      });
      return res;
    }
    if (GREETING.test(text) && text.split(' ').length <= 4) {
      replies.push({
        text: tr(
          L,
          `Hello ${name}, welcome. How may I help you today?`,
          `أهلاً ${name}، مرحباً بك. كيف يمكنني مساعدتك اليوم؟`,
        ),
        chips: DEFAULT_CHIPS[L],
      });
      return res;
    }
  }

  // 5. Status and cancellation.
  if (wantsStatus || allMatches.some((m) => ITEM_BY_KEY[m.key]?.action === 'status')) {
    const open = ctx.tickets.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
    replies.push(
      open.length
        ? {
            text: tr(
              L,
              `Here is the latest on your requests, ${name}:`,
              `إليك آخر المستجدات على طلباتك يا ${name}:`,
            ),
            cards: [{ type: 'tickets', ticketIds: open.map((t) => t.id) }],
          }
        : {
            text: tr(
              L,
              'You have no open requests at the moment. Is there anything I can arrange for you?',
              'ليس لديك طلبات مفتوحة حالياً. هل يمكنني ترتيب شيء لك؟',
            ),
            chips: DEFAULT_CHIPS[L],
          },
    );
    return res;
  }
  if (wantsCancel) {
    const keys = new Set(allMatches.map((m) => m.key));
    const cancellable = ctx.tickets
      .filter((t) => t.status === 'new' || t.status === 'accepted')
      .sort((a, b) => b.createdAt - a.createdAt);
    const names = new Set([...keys].map((key) => ITEM_BY_KEY[key]?.en));
    const target = keys.size ? cancellable.find((t) => names.has(t.item)) : cancellable[0];
    if (target) {
      res.cancel.push(target.id);
      replies.push({
        text: tr(
          L,
          `Done. I've cancelled “${target.item}” (${target.id}).`,
          `تم. ألغيت طلب «${target.item}» (${target.id}).`,
        ),
      });
    } else {
      const onTheWay = ctx.tickets.find((t) => t.status === 'on_the_way');
      replies.push({
        text: onTheWay
          ? tr(
              L,
              `That request is already on its way, so I've asked your ambassador to help with the change.`,
              'هذا الطلب في الطريق إليك بالفعل، لذلك طلبت من السفير مساعدتك في التعديل.',
            )
          : tr(
              L,
              "I couldn't find an open request to cancel. Could you tell me which one?",
              'لم أجد طلباً مفتوحاً لإلغائه. هل يمكنك تحديده؟',
            ),
      });
      if (onTheWay)
        res.handover = {
          reason: `Guest wants to change ${onTheWay.item} (${onTheWay.id}) already on the way`,
          urgency: 'normal',
        };
    }
    return res;
  }

  // 6. Knowledge-base questions.
  const question = isQuestion(masked);
  const request = hasRequestMarker(masked) || hasProblemMarker(masked);
  const kbTopics: KbTopic[] = [...outletTopics(k), ...KB_TOPICS];
  const kbAnswer = (topicIds: string[]) => {
    for (const id of topicIds) {
      const topic = kbTopics.find((t) => t.id === id);
      if (!topic) continue;
      const a = topic.answer(k, L);
      replies.push({ text: a.text, cards: [{ type: 'info', sample: a.sample }] });
    }
  };
  if (question && !request && !complaint) {
    const kbMatches = findMatches(
      text,
      kbTopics.map((t) => ({ key: t.id, kw: t.kw })),
    );
    if (kbMatches.length) {
      kbAnswer([...new Set(kbMatches.map((m) => m.key))].slice(0, 2));
      return res;
    }
  }

  // 7. Requests from the catalogue and the menu.
  const order: DiningItem[] = [];
  const ticketDrafts: TicketDraft[] = [];
  const asks: TicketDraft[] = [];
  const timeAsks: TicketDraft[] = [];
  const bookings: Array<{ booking: BookingDraft }> = [];
  const menuCards: Card[] = [];
  const kbIds: string[] = [];
  const verify: TicketDraft[] = [];
  let sensitive: CatalogueItem | undefined;

  for (const { seg, matches } of segMatches) {
    for (const m of matches) {
      if (m.key.startsWith('outlet:')) continue;
      if (m.key.startsWith('menu:')) {
        const mi = menu.find((x) => `menu:${x.id}` === m.key);
        if (!mi) continue;
        const qty = m.impliedQty ?? quantityNear(seg, m.start, m.end) ?? 1;
        const modifiers = mi.modifiers.filter((mod) => findKeyword(seg, normalize(mod)).length);
        const existing = order.find((o) => o.id === mi.id);
        if (existing) existing.qty += qty;
        else order.push({ id: mi.id, name: mi.name, qty, modifiers });
        continue;
      }
      const item = ITEM_BY_KEY[m.key];
      if (!item) continue;
      const action = item.action ?? 'ticket';
      if (action === 'kb' && item.kb) {
        kbIds.push(item.kb);
        continue;
      }
      if (action === 'menu') {
        const filter =
          item.context === 'dietary'
            ? [
                'vegan',
                'vegetarian',
                'gluten free',
                'gluten-free',
                'dairy free',
                'nut free',
                'halal',
                'نباتي',
                'حلال',
              ].find((f) => text.includes(normalize(f)))
            : undefined;
        if (!menuCards.length)
          menuCards.push({
            type: 'menu',
            category:
              item.context === 'kids' || item.context === 'breakfast' ? item.context : undefined,
            filter: filter
              ?.replace(/[- ]/g, '_')
              .replace('نباتي', 'vegetarian')
              .replace('حلال', 'halal'),
          });
        continue;
      }
      if (action === 'restaurant' || action === 'spa' || action === 'transport') {
        const kind = action === 'restaurant' ? 'restaurant' : action;
        if (bookings.some((b) => b.booking.kind === kind)) continue;
        let booking: BookingDraft = { kind };
        if (kind === 'transport') {
          const ctxType = item.context ?? 'taxi';
          booking.outlet =
            ctxType === 'airport'
              ? /\b(from the airport|arriv|pick (me|us) up from)\b|من المطار/.test(text)
                ? 'airport_arrival'
                : 'airport_departure'
              : ctxType;
          if (ctxType === 'airport')
            booking.destination = booking.outlet === 'airport_arrival' ? 'Hotel' : 'Airport';
          if (booking.outlet === 'airport_arrival') booking.pickup = 'Airport';
        }
        if (kind === 'spa') booking.outlet = resolveTreatment(text, k, item.context);
        if (item.context === 'beach or terrace table') booking.notes = 'Beach or terrace table';
        booking = fillBooking(booking, masked, k);
        const occasion = ['birthday', 'anniversary', 'honeymoon', 'عيد ميلاد', 'ذكري'].find((o) =>
          text.includes(o),
        );
        if (occasion && kind === 'restaurant')
          booking.occasion = /عيد/.test(occasion)
            ? 'Birthday'
            : /ذكر/.test(occasion)
              ? 'Anniversary'
              : occasion[0]!.toUpperCase() + occasion.slice(1);
        bookings.push({ booking });
        continue;
      }
      if (action === 'handover') {
        if (!sensitive || (item.prio === 'urgent' && sensitive.prio !== 'urgent')) sensitive = item;
        continue;
      }
      // Plain service ticket.
      const hint = item.hints
        ? Object.entries(item.hints).find(
            ([w]) => findKeyword(seg, normalize(w)).length || seg.includes(normalize(w)),
          )?.[1]
        : undefined;
      const pt = parseTime(seg);
      const preferred = item.time
        ? pt.time || pt.date
          ? fmtTime(pt.time, pt.date, 'en')
          : undefined
        : undefined;
      const quantity = item.qty
        ? (m.impliedQty ??
          quantityNear(seg, m.start, m.end) ??
          (item.qty === 'default' ? 1 : undefined))
        : undefined;
      const draft = draftFromItem(item, {
        quantity,
        details: [hint, item.context].filter(Boolean).join(' · ') || undefined,
        preferredTime: preferred,
        priority: complaint ? 'high' : undefined,
      });
      if (ticketDrafts.some((d) => d.itemKey === draft.itemKey)) continue;
      if (action === 'verify') verify.push(draft);
      else if (item.qty === 'ask' && quantity === undefined) asks.push(draft);
      else if (item.time === 'ask' && !preferred) timeAsks.push(draft);
      else ticketDrafts.push(draft);
    }
  }

  // Sensitive topics and unhappy guests always reach a person.
  const handoverReasons: string[] = [];
  if (sensitive) handoverReasons.push(`${sensitive.en}`);
  if (complaint) handoverReasons.push('Guest is unhappy / complaint');
  if (refund) handoverReasons.push('Refund or compensation request');
  if (otherGuest && !sensitive) handoverReasons.push('Matter concerning another guest');

  if (handoverReasons.length) {
    const urgency: Priority = sensitive?.prio === 'urgent' ? 'urgent' : 'high';
    const dept = sensitive?.dept ?? 'frontoffice';
    res.drafts.push({
      department: dept,
      alsoNotify:
        sensitive?.also ?? (sensitive?.sensitive === 'security' ? 'dutymanager' : undefined),
      category: sensitive ? sectionName(sensitive) : 'Guest Relations',
      item: sensitive
        ? sensitive.en
        : complaint
          ? 'Guest complaint'
          : refund
            ? 'Refund / compensation request'
            : 'Matter concerning another guest',
      itemKey: sensitive?.key,
      details: handoverReasons.join(' · '),
      priority: urgency,
      kind: 'handover',
    });
    res.handover = { reason: handoverReasons.join(' · '), urgency };
  }

  res.drafts.push(...ticketDrafts);

  // Compose replies -------------------------------------------------------
  if (complaint || refund) {
    replies.push({
      text: tr(
        L,
        `I'm truly sorry, ${name}. I've asked your ambassador, ${ctx.guest.ambassador}, to look after this personally and contact you right away.`,
        `أعتذر بشدة يا ${name}. طلبت من ${ctx.guest.ambassador} من فريق سفراء التجربة متابعة الأمر شخصياً وللتواصل معك فوراً.`,
      ),
    });
  }
  if (sensitive?.sensitive === 'medical') {
    replies.push({
      text: tr(
        L,
        `${name}, I've alerted our team and the Rooms Controller; a colleague will call you within minutes. If this is an emergency, please follow the guidance below now.`,
        `${name}، أبلغت فريقنا ومراقب الغرف، وسيتصل بك زميل خلال دقائق. إذا كانت حالة طارئة فيرجى اتباع الإرشادات أدناه الآن.`,
      ),
      cards: [{ type: 'emergency' }],
    });
  } else if (sensitive?.sensitive === 'security') {
    replies.push({
      text: tr(
        L,
        `${name}, I've alerted our Security team and the Rooms Controller; someone will be with you shortly. If you are in immediate danger, please call the emergency extension on your room phone.`,
        `${name}، أبلغت فريق الأمن ومراقب الغرف وسيصل إليك أحدهم قريباً. إذا كنت في خطر مباشر فيرجى الاتصال برقم الطوارئ من هاتف الغرفة.`,
      ),
    });
  } else if (sensitive) {
    replies.push({
      text:
        sensitive.key === 'ambassador'
          ? tr(
              L,
              `Of course. I've let ${ctx.guest.ambassador}, your ambassador, know; they will join this chat shortly.`,
              `بالتأكيد. أبلغت ${ctx.guest.ambassador} من فريق سفراء التجربة، وسينضم إلى المحادثة قريباً.`,
            )
          : tr(
              L,
              `I've passed this to your ambassador, ${ctx.guest.ambassador}, who will take care of it personally.`,
              `أحلت هذا إلى ${ctx.guest.ambassador} من فريق سفراء التجربة، لمتابعته شخصياً.`,
            ),
    });
  } else if (otherGuest && !complaint) {
    replies.push({
      text: tr(
        L,
        `Thank you, ${name}. Matters involving other guests are handled personally by our team, so I've passed this to your ambassador.`,
        `شكراً ${name}. نتعامل مع الأمور المتعلقة بالنزلاء الآخرين بشكل شخصي، لذلك أحلت هذا إلى السفير.`,
      ),
    });
  }

  if (ticketDrafts.length) {
    const lead = complaint
      ? tr(L, 'I have also logged the issue as a priority:', 'وسجلت المشكلة كأولوية:')
      : ticketDrafts.length > 1
        ? tr(
            L,
            `Of course, ${name}. I've arranged the following:`,
            `بالتأكيد يا ${name}. رتبت لك ما يلي:`,
          )
        : tr(
            L,
            `Of course, ${name}. I've sent this to our ${ticketDrafts[0]!.department === 'engineering' ? 'engineering' : 'team'} and will update you here.`,
            `بالتأكيد يا ${name}. أرسلت طلبك إلى الفريق المختص وسأبلغك بالمستجدات هنا.`,
          );
    replies.push({ text: lead, cards: [{ type: 'tickets', ticketIds: [NEW_TICKETS] }] });
  } else if (res.drafts.length) {
    // Handover tickets only: show their status too.
    const last = replies[replies.length - 1];
    if (last) last.cards = [...(last.cards ?? []), { type: 'tickets', ticketIds: [NEW_TICKETS] }];
  }

  // Information answers only when asked, not as a side effect of a request.
  const actionable =
    ticketDrafts.length ||
    bookings.length ||
    order.length ||
    sensitive ||
    asks.length ||
    timeAsks.length;
  if (kbIds.length && (question || !actionable)) kbAnswer([...new Set(kbIds)].slice(0, 2));
  else if (!actionable && !kbIds.length && question) {
    const outletHit = allMatches.find((m) => m.key.startsWith('outlet:'));
    if (outletHit) kbAnswer([outletHit.key]);
  }

  if (order.length) {
    const allergyList = detectAllergies(text);
    const pt = parseTime(masked);
    const dining: DiningOrder = {
      items: order,
      allergies: allergyList.length ? allergyList.join(', ') : undefined,
      deliveryTime: pt.time && pt.time !== 'now' ? fmtTime(pt.time, pt.date, 'en') : undefined,
    };
    replies.push({
      text: orderReadBack(dining, k, L),
      cards: [{ type: 'order_confirm', order: dining, state: 'pending' }],
      chips: L === 'ar' ? ['نعم', 'تعديل'] : ['Yes, place it', 'Change'],
    });
    res.pending = { type: 'order_confirm', order: dining, lang };
  } else if (menuCards.length) {
    replies.push({
      text: tr(
        L,
        'Here is our in-room dining menu. Tap to add items, and tell me about any allergies.',
        'هذه قائمة الطعام في الغرفة. اضغط لإضافة الأصناف، وأخبرني بأي حساسية غذائية.',
      ),
      cards: menuCards,
    });
  }

  for (const { booking } of bookings) {
    const missing = missingBookingField(booking);
    if (!missing) {
      res.drafts.push(bookingDraftToTicket(booking, k));
      replies.push({
        text: bookingConfirmation(booking, k, L),
        cards: [
          { type: 'booking', booking, state: 'done' },
          { type: 'tickets', ticketIds: [NEW_TICKETS] },
        ],
      });
    } else if (res.pending === undefined || res.pending === null) {
      const q = bookingQuestion(booking, missing, k, L);
      replies.push({
        text: q.text,
        chips: q.chips,
        cards: [{ type: 'booking', booking, state: 'pending' }],
      });
      res.pending = { type: 'booking', booking, asking: missing, lang };
    } else {
      replies.push({
        text: tr(L, 'You can complete this booking here:', 'يمكنك إكمال هذا الحجز هنا:'),
        cards: [{ type: 'booking', booking, state: 'pending' }],
      });
    }
  }

  if (verify.length && !res.pending) {
    replies.push({
      text: tr(
        L,
        `For your privacy, could you confirm the surname on the reservation for room ${ctx.guest.room}?`,
        `حفاظاً على خصوصيتك، هل يمكنك تأكيد اسم العائلة المسجل في حجز الغرفة ${ctx.guest.room}؟`,
      ),
    });
    res.pending = { type: 'verify', draft: verify[0]!, lang };
  }

  if ((asks.length || timeAsks.length) && !res.pending) {
    const first = (asks[0] ?? timeAsks[0])!;
    const isTime = !asks.length;
    const item = first.itemKey ? ITEM_BY_KEY[first.itemKey] : undefined;
    const label = item ? itemName(item, L).toLowerCase() : first.item.toLowerCase();
    replies.push(
      isTime
        ? {
            text: tr(L, `What time would you like the ${label}?`, `في أي وقت تود ${label}؟`),
            chips: ['06:30', '07:00', '07:30', '08:00'],
          }
        : {
            text: tr(
              L,
              `How many ${label.replace(/^extra /, '')} would you like?`,
              `كم ${label} تحتاج؟`,
            ),
            chips: ['1', '2', '3', '4'],
          },
    );
    res.pending = {
      type: isTime ? 'time' : 'quantity',
      draft: first,
      rest: [...asks, ...timeAsks].slice(1),
      lang,
    };
  }

  if (!replies.length || replies.length === (found.length ? 1 : 0) + (lang === 'other' ? 1 : 0)) {
    if (question || !hasLetters) {
      res.drafts.push({
        department: 'frontoffice',
        category: 'Guest Relations',
        item: 'Guest question to answer',
        details: 'Concierge could not answer from the knowledge base.',
        priority: 'normal',
        kind: 'handover',
      });
      replies.push({
        text: tr(
          L,
          `I'm sorry, ${name}, I don't have that information yet, and I'd rather not guess. I've passed your question to your ambassador, ${ctx.guest.ambassador}, who will reply here shortly.`,
          `عذراً يا ${name}، لا تتوفر لدي هذه المعلومة حالياً ولا أريد التخمين. أحلت سؤالك إلى ${ctx.guest.ambassador} من فريق سفراء التجربة للرد عليك هنا قريباً.`,
        ),
        cards: [{ type: 'tickets', ticketIds: [NEW_TICKETS] }],
      });
    } else {
      replies.push({
        text: tr(
          L,
          `I want to get this exactly right, ${name}. Could you tell me a little more, or choose an option below? You can also speak to your ambassador at any time.`,
          `أريد أن أخدمك بدقة يا ${name}. هل يمكنك توضيح طلبك قليلاً، أو اختيار أحد الخيارات أدناه؟ ويمكنك التحدث إلى السفير في أي وقت.`,
        ),
        chips: [
          ...DEFAULT_CHIPS[L].slice(0, 4),
          L === 'ar' ? 'التحدث إلى السفير' : 'Speak to my ambassador',
        ],
      });
    }
  }
  return res;
}

function resolvePending(
  raw: string,
  text: string,
  pending: PendingState,
  ctx: EngineContext,
  res: EngineResult,
  L: L,
): boolean {
  const replies = res.replies;
  const k = ctx.knowledge;
  if (pending.type === 'quantity' || pending.type === 'time') {
    const draft = { ...pending.draft };
    if (pending.type === 'quantity') {
      const n =
        wordToNumber(text.split(' ')[0] ?? '') ??
        quantityNear(text, text.length, text.length) ??
        text.match(/\d+/)?.[0];
      const qty = typeof n === 'string' ? Number(n) : n;
      if (!qty) return false;
      draft.quantity = Math.min(qty, 20);
    } else {
      const pt = parseTime(raw);
      const bare = text.match(/^(\d{1,2})(?::(\d{2}))?$/);
      const time =
        pt.time ?? (bare ? `${bare[1]!.padStart(2, '0')}:${bare[2] ?? '00'}` : undefined);
      if (!time) return false;
      draft.preferredTime = fmtTime(time, pt.date, 'en');
    }
    res.drafts.push(draft);
    const item = draft.itemKey ? ITEM_BY_KEY[draft.itemKey] : undefined;
    const label = item ? itemName(item, L) : draft.item;
    replies.push({
      text: tr(
        L,
        `Thank you. ${draft.quantity && pending.type === 'quantity' ? `${draft.quantity} × ` : ''}${label} ${pending.type === 'time' ? `at ${draft.preferredTime} ` : ''}is on its way to our team.`,
        `شكراً. تم إرسال طلب ${label}${draft.quantity && pending.type === 'quantity' ? ` (${draft.quantity})` : ''} إلى الفريق.`,
      ),
      cards: [{ type: 'tickets', ticketIds: [NEW_TICKETS] }],
    });
    const [next, ...rest] = pending.rest;
    if (next) {
      const nItem = next.itemKey ? ITEM_BY_KEY[next.itemKey] : undefined;
      const nLabel = nItem ? itemName(nItem, L).toLowerCase() : next.item.toLowerCase();
      const isTime = nItem?.time === 'ask' && !nItem.qty;
      replies.push({
        text: isTime
          ? tr(L, `And what time would you like the ${nLabel}?`, `وفي أي وقت تود ${nLabel}؟`)
          : tr(L, `And how many ${nLabel.replace(/^extra /, '')}?`, `وكم ${nLabel}؟`),
        chips: isTime ? ['06:30', '07:00', '07:30'] : ['1', '2', '3', '4'],
      });
      res.pending = { type: isTime ? 'time' : 'quantity', draft: next, rest, lang: pending.lang };
    } else res.pending = null;
    return true;
  }
  if (pending.type === 'order_confirm') {
    if (isAffirmative(raw)) {
      res.drafts.push(orderDraft(pending.order));
      res.completeCardMessageId = pending.messageId;
      res.pending = null;
      replies.push({
        text: tr(
          L,
          `Your order is placed, ${ctx.guest.firstName}. Our in-room dining team has it now; I'll let you know when it's on the way. It will be charged to room ${ctx.guest.room} (${ctx.guest.lastName}).`,
          `تم تأكيد طلبك يا ${ctx.guest.firstName}. فريق خدمة الطعام في الغرفة يعمل عليه الآن، وسأبلغك عندما يكون في الطريق. سيُضاف إلى حساب الغرفة ${ctx.guest.room}.`,
        ),
        cards: [{ type: 'tickets', ticketIds: [NEW_TICKETS] }],
      });
      return true;
    }
    if (isNegative(raw)) {
      res.pending = null;
      replies.push({
        text: tr(
          L,
          'Of course. What would you like to change? You can also pick from the menu.',
          'بالتأكيد. ما الذي تود تعديله؟ يمكنك أيضاً الاختيار من القائمة.',
        ),
        cards: [{ type: 'menu' }],
      });
      return true;
    }
    // Adding allergies to a pending order keeps the order open.
    const extra = detectAllergies(text);
    if (extra.length) {
      const order = {
        ...pending.order,
        allergies: [...new Set([...(pending.order.allergies?.split(', ') ?? []), ...extra])].join(
          ', ',
        ),
      };
      res.pending = { ...pending, order, messageId: undefined };
      replies.push({
        text: orderReadBack(order, k, L),
        cards: [{ type: 'order_confirm', order, state: 'pending' }],
        chips: L === 'ar' ? ['نعم', 'تعديل'] : ['Yes, place it', 'Change'],
      });
      return true;
    }
    return false;
  }
  if (pending.type === 'booking') {
    const before = pending.booking;
    const booking = fillBooking(before, raw, k, pending.asking);
    if (JSON.stringify(booking) === JSON.stringify(before)) return false;
    const missing = missingBookingField(booking);
    if (!missing) {
      res.drafts.push(bookingDraftToTicket(booking, k));
      res.completeCardMessageId = pending.messageId;
      res.pending = null;
      replies.push({
        text: bookingConfirmation(booking, k, L),
        cards: [{ type: 'tickets', ticketIds: [NEW_TICKETS] }],
      });
      return true;
    }
    const q = bookingQuestion(booking, missing, k, L);
    replies.push({ text: q.text, chips: q.chips });
    res.pending = { ...pending, booking, asking: missing };
    return true;
  }
  if (pending.type === 'verify') {
    const surname = normalize(ctx.guest.lastName);
    res.pending = null;
    if (text.includes(surname)) {
      res.drafts.push(pending.draft);
      replies.push({
        text: tr(
          L,
          `Thank you, ${ctx.guest.firstName}, that matches our records. I've asked the front office to send it to the email on your reservation.`,
          `شكراً ${ctx.guest.firstName}، البيانات مطابقة. طلبت من المكتب الأمامي إرسالها إلى بريدك الإلكتروني المسجل.`,
        ),
        cards: [{ type: 'tickets', ticketIds: [NEW_TICKETS] }],
      });
    } else {
      res.handover = { reason: 'Billing request: surname did not match', urgency: 'normal' };
      res.drafts.push({
        ...pending.draft,
        kind: 'handover',
        details: 'Surname did not match reservation. Verify in person.',
      });
      replies.push({
        text: tr(
          L,
          "That doesn't match our records, so for your security I've asked your ambassador to help you in person.",
          'البيانات غير مطابقة لسجلاتنا، لذلك حرصاً على أمانك طلبت من السفير مساعدتك شخصياً.',
        ),
      });
    }
    return true;
  }
  return false;
}
