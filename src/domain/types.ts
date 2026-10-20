export type DepartmentId =
  | 'frontoffice'
  | 'housekeeping'
  | 'laundry'
  | 'engineering'
  | 'ird'
  | 'restaurants'
  | 'spa'
  | 'recreation'
  | 'concierge'
  | 'security'
  | 'it'
  | 'dutymanager';

export type Priority = 'normal' | 'high' | 'urgent';
export type TicketStatus = 'new' | 'accepted' | 'on_the_way' | 'done' | 'cancelled';
export type Lang = 'en' | 'ar' | 'other';
/** 0 = within standard, 1 = supervisor, 2 = Rooms Controller */
export type EscalationLevel = 0 | 1 | 2;

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  room: string;
  arrival: string; // ISO date
  departure: string; // ISO date
  ambassador: string;
  /** Placeholder guest created for the demo. */
  sample?: boolean;
  /** Set when the front office checks the guest out; they can no longer sign in. */
  checkedOutAt?: number;
}

export interface TicketNote {
  at: number;
  by: string;
  text: string;
}

export interface Ticket {
  id: string;
  department: DepartmentId;
  /** Secondary department that also receives a copy (e.g. Wi-Fi → IT). */
  alsoNotify?: DepartmentId;
  category: string;
  item: string;
  itemKey?: string;
  quantity?: number;
  details?: string;
  preferredTime?: string;
  room: string;
  guestId: string;
  guestName: string;
  priority: Priority;
  status: TicketStatus;
  createdAt: number;
  acceptedAt?: number;
  onTheWayAt?: number;
  doneAt?: number;
  cancelledAt?: number;
  assignee?: string;
  notes: TicketNote[];
  /** Highest escalation level reached; kept after acceptance for reporting. */
  escalationLevel: EscalationLevel;
  originalMessage?: string;
  language: Lang;
  kind: 'service' | 'dining' | 'reservation' | 'spa' | 'transport' | 'handover' | 'recovery';
  /** Structured payload for dining orders, reservations etc. */
  payload?: Record<string, unknown>;
  rating?: number;
  sample?: boolean;
}

export type MessageSender = 'guest' | 'ai' | 'staff' | 'system';

export type Card =
  | { type: 'tickets'; ticketIds: string[] }
  | { type: 'menu'; category?: string; filter?: string }
  | { type: 'order_confirm'; order: DiningOrder; state: 'pending' | 'placed' | 'changed' }
  | { type: 'booking'; booking: BookingDraft; state: 'pending' | 'done' }
  | { type: 'emergency' }
  | { type: 'handover'; staffName: string }
  | { type: 'rating'; ticketId: string; value?: number }
  | { type: 'privacy' }
  | { type: 'info'; sample: boolean };

export interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  staffName?: string;
  text: string;
  /** Text as typed, when masking changed it. Never stored when it held ID data. */
  lang: Lang;
  at: number;
  cards?: Card[];
  chips?: string[];
}

export interface Conversation {
  id: string;
  guestId: string;
  /** 'ai' = concierge replies; 'human' = a staff member has taken over. */
  mode: 'ai' | 'human';
  humanName?: string;
  /** Set when the guest has been promised a person but nobody has joined yet. */
  handoverRequested?: { reason: string; at: number; urgency: Priority };
  pending?: PendingState;
  lang: 'en' | 'ar';
  /** The concierge is composing a reply. */
  typing?: boolean;
  /** Last time the guest wrote, and last time staff opened the chat (for unread counts). */
  lastGuestAt?: number;
  staffReadAt?: number;
  signedInAt?: number;
}

export interface DiningItem {
  id: string;
  name: string;
  qty: number;
  modifiers: string[];
}

export interface DiningOrder {
  items: DiningItem[];
  allergies?: string;
  deliveryTime?: string;
  notes?: string;
}

export type BookingKind = 'restaurant' | 'spa' | 'transport';

export interface BookingDraft {
  kind: BookingKind;
  outlet?: string; // restaurant id, spa treatment id or transport type
  date?: string;
  time?: string;
  partySize?: number;
  occasion?: string;
  notes?: string;
  pickup?: string;
  destination?: string;
  luggage?: number;
  therapist?: string;
}

export type PendingState =
  | { type: 'quantity' | 'time'; draft: TicketDraft; rest: TicketDraft[]; lang: Lang }
  | { type: 'order_confirm'; order: DiningOrder; messageId?: string; lang: Lang }
  | { type: 'booking'; booking: BookingDraft; asking: BookingField; messageId?: string; lang: Lang }
  | { type: 'verify'; draft: TicketDraft; lang: Lang };

export type BookingField = 'outlet' | 'date' | 'time' | 'partySize' | 'destination' | 'passengers';

export interface TicketDraft {
  department: DepartmentId;
  alsoNotify?: DepartmentId;
  category: string;
  item: string;
  itemKey?: string;
  quantity?: number;
  details?: string;
  preferredTime?: string;
  priority: Priority;
  kind: Ticket['kind'];
  payload?: Record<string, unknown>;
}

export interface Rating {
  ticketId: string;
  value: number;
  at: number;
}

export type Standards = Record<DepartmentId, { normal: number; urgent?: number }>;

export interface StaffSession {
  department: DepartmentId;
  name: string;
}
