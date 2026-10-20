import { DEMO_GUEST_ID } from '../data/demo';
import {
  advanceClock,
  getState,
  handBackToAi,
  rateTicket,
  resetDemo,
  sendGuestMessage,
  setGuestLanguage,
  setTicketStatus,
  staffReply,
} from '../store/store';

export interface DemoStep {
  id: string;
  title: string;
  narration: string;
  run: (ctx: { sleep: (ms: number) => Promise<void> }) => Promise<void>;
}

const findTicket = (pred: (t: ReturnType<typeof getState>['tickets'][number]) => boolean) =>
  [...getState().tickets]
    .reverse()
    .find((t) => !t.sample && t.guestId === DEMO_GUEST_ID && pred(t));

/** Time for a streamed reply to finish on screen before the next action. */
const readTime = () => {
  const last = getState().messages.at(-1);
  return Math.min(2600, 500 + (last?.text.length ?? 0) * 9);
};

/**
 * The guided demo: five scenarios from the brief, played through the same store
 * actions a guest and staff member would use, so nothing is faked on screen.
 */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'multi',
    title: 'One message, three departments',
    narration:
      'The guest writes one free sentence. The concierge creates an Engineering ticket and a Housekeeping ticket, and asks one short question before booking the table.',
    run: async ({ sleep }) => {
      await sendGuestMessage(
        DEMO_GUEST_ID,
        'Hi, the AC in my room is quite loud, could you send two extra towels, and book a table at the Beach Grill for 8 tonight?',
      );
      await sleep(readTime() + 900);
      await sendGuestMessage(DEMO_GUEST_ID, 'Two of us, please');
      await sleep(readTime());
    },
  },
  {
    id: 'respond',
    title: 'Departments act, the guest is updated',
    narration:
      'Engineering and Housekeeping accept from the board. Each step appears in the guest’s chat and on the My requests tracker.',
    run: async ({ sleep }) => {
      const ac = findTicket((t) => t.itemKey === 'ac');
      const towels = findTicket((t) => t.itemKey === 'towels');
      if (ac) setTicketStatus(ac.id, 'accepted', 'Rajesh');
      await sleep(1100);
      if (towels) setTicketStatus(towels.id, 'accepted', 'Maria');
      await sleep(1100);
      if (towels) setTicketStatus(towels.id, 'on_the_way', 'Maria');
      await sleep(1100);
      if (ac) setTicketStatus(ac.id, 'on_the_way', 'Rajesh');
      await sleep(900);
    },
  },
  {
    id: 'dining',
    title: 'In-room dining, read back before ordering',
    narration:
      'The concierge matches dishes and options from the menu, flags the allergy, repeats the order and waits for a clear “yes” before sending it to the kitchen.',
    run: async ({ sleep }) => {
      await sendGuestMessage(
        DEMO_GUEST_ID,
        "Could I order a club sandwich with brown bread and a fresh orange juice? I'm allergic to nuts.",
      );
      await sleep(readTime() + 1200);
      await sendGuestMessage(DEMO_GUEST_ID, 'Yes, please');
      await sleep(readTime());
    },
  },
  {
    id: 'escalation',
    title: 'Escalation when nobody accepts',
    narration:
      'Nobody has accepted the dining order. At 100% of the 3-minute standard it goes to the supervisor; at 200% to the Rooms Controller. The demo clock is fast-forwarded to show it.',
    run: async ({ sleep }) => {
      advanceClock(3.2);
      await sleep(2400);
      advanceClock(3);
      await sleep(2600);
      const order = findTicket((t) => t.kind === 'dining');
      if (order) setTicketStatus(order.id, 'accepted', 'Sherif (Rooms Controller)');
      await sleep(900);
    },
  },
  {
    id: 'recovery',
    title: 'Low rating opens service recovery',
    narration:
      'Engineering closes the AC ticket and the guest is asked for a rating. A score of 2 automatically opens a High-priority recovery ticket, and the ambassador joins the chat in person.',
    run: async ({ sleep }) => {
      const ac = findTicket((t) => t.itemKey === 'ac');
      if (ac) setTicketStatus(ac.id, 'done', 'Rajesh');
      await sleep(1800);
      if (ac) rateTicket(ac.id, 2);
      await sleep(2600);
      const recovery = findTicket((t) => t.kind === 'recovery');
      if (recovery) setTicketStatus(recovery.id, 'accepted', 'Nadia');
      staffReply(
        DEMO_GUEST_ID,
        "I'm so sorry the noise is still bothering you, Ms Mitchell. I'm on my way up now, and if we can't fix it tonight we'll move you to a quieter room.",
        'Nadia',
        'frontoffice',
      );
      await sleep(2200);
    },
  },
  {
    id: 'arabic',
    title: 'Arabic, right to left',
    narration:
      'The guest switches to Arabic. Replies and the whole layout follow; staff still receive English tickets with the original Arabic message attached.',
    run: async ({ sleep }) => {
      setGuestLanguage(DEMO_GUEST_ID, 'ar');
      handBackToAi(DEMO_GUEST_ID);
      await sleep(900);
      await sendGuestMessage(DEMO_GUEST_ID, 'ممكن مخدتين إضافيتين وتنظيف الغرفة الساعة ٣ العصر؟');
      await sleep(readTime());
    },
  },
];

export function resetForDemo() {
  resetDemo({ keepSettings: true });
}
