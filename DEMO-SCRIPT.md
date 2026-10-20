# Demo script · 5 minutes

For the General Manager, senior management and IT. Presenter: Sherif El Naggar. Hotel: Rixos Bab Al Bahr.

## Before the meeting (5 minutes)

1. Open the live site on the laptop and go to **Present** (`#/present`). Press **Reset**.
2. On your phone, scan the QR code on the landing page and sign in as a guest: room `1207`, surname `Mitchell` (or tap “Continue as Sarah Mitchell”). Use room `0412`, surname `Rahman` for a second guest.
3. In a second laptop tab, open the **Staff board** (`#/staff`), sign in as Duty Manager with PIN `1234`, and choose **All departments**. Keep it ready for questions.
4. Turn the laptop volume low (new tickets make a soft chime). Set the projector to light mode, or use the moon icon for dark mode.

Check the header badge says **Live on all devices**. Phone and laptop then share the same demo; **Reset** clears both. If the Wi-Fi fails, the badge shows **Offline · this device only** and Present mode still runs the whole demo on the laptop.

## The walkthrough

### 0:00 · The problem and the idea (30 seconds)

> “Today guests call, message, or stop someone in the corridor, and requests are passed on by hand. This is one concierge in the guest's own words, in any language, that routes every request to the right team and keeps the guest informed until it's done. It never guesses, and a person is always one tap away.”

Point at the split screen: guest phone on the left, the live staff board on the right, same data.

### 0:30 · Step 1: one message, three departments (60 seconds)

Press **Start guided demo**.

- The guest writes one sentence: the AC is loud, two towels, a table at the Beach Grill for 8 tonight.
- Watch the tickets fly to **Engineering** and **Housekeeping**. The AC ticket says “Noisy”; the towels show “2 ×”.
- The concierge asks only what is missing (“How many guests?”). The guest answers and the reservation goes to **Restaurants**.

> “It didn't guess the number of guests. It asked one short question.”

### 1:30 · Step 2: departments act, the guest is updated (30 seconds)

Press **Next step**. Engineering and Housekeeping accept, then are on their way. Each step appears in the guest's chat and on the **My requests** tracker.

> “The guest never has to call to ask where something is.”

### 2:00 · Step 3: in-room dining (40 seconds)

Press **Next step**. The guest orders a club sandwich with brown bread and an orange juice, and mentions a nut allergy.

- The concierge repeats the order and waits for “yes”.
- The ticket reaches In-Room Dining as **High** priority with **ALLERGY: nuts**.

### 2:40 · Step 4: escalation (40 seconds)

Press **Next step**. The demo clock is fast-forwarded.

- At 100% of the 3-minute standard the ticket turns red and goes to the **IRD Supervisor**.
- At 200% it reaches the **Duty Manager** (Duty Manager tab), who accepts it.

> “Response standards are set per department in Settings. Nobody has to watch the clock.”

### 3:20 · Step 5: low rating, service recovery (40 seconds)

Press **Next step**. Engineering closes the AC ticket; the guest rates it 2 out of 5.

- A **High-priority service-recovery** ticket opens for the ambassador automatically.
- Nadia, the ambassador, joins the chat. The banner changes to “You're chatting with Nadia”, so the guest knows a person has taken over.

### 4:00 · Step 6: Arabic (30 seconds)

Press **Next step**. The guest switches to Arabic: the whole app turns right to left and the reply is in Arabic. On the board, the tickets are in English with an **AR** tag; open one to show the original Arabic message.

### 4:30 · Close and hand over to questions (30 seconds)

> “Everything you saw is the working app, not a recording. Three things decide the next step: approving the real hotel content, choosing pilot rooms, and IT's go-ahead for phase 2, which adds the live AI and a shared database.”

Open **Insights** for management questions or **For IT** for architecture, security and the rollout.

## Likely questions

- **What if the AI gets it wrong?** It only answers from approved content, asks when details are missing, and hands over to a person for anything sensitive. Every request is validated before a ticket exists.
- **Guest data?** Card, passport and ID numbers are masked and never stored. The pilot keeps only room, name, requests and ratings, with row-level security.
- **Cost?** The demo costs nothing. The pilot AI costs a few dollars a month at test volumes with Claude Haiku 5.5; see the README for whole-hotel estimates.
- **Integration?** Phase 3 connects the property management, work-order and point-of-sale systems through their existing interfaces, with IT.

## Live extras, if time allows

- Hand your phone to the General Manager with the guest app open. Their request appears on the laptop's staff board within a second; accept it on the laptop and the phone updates.
- Show sign-in: on the staff board open **In-house guests**, add the GM as a guest (any free room), copy the **Sign-in link**, and let them sign in on their own phone with their surname.
- Show a person taking over: ask the guest to type “I'd like to speak to someone”. On the laptop, **Guest chats** turns red with a chime; reply, and the phone shows “You're chatting with …”. Press **Hand back to AI** when done.

- Type your own request on the phone, for example “Can I get a baby cot and an iron?”, or ask “What time is check-out?” (the answer carries a Sample content badge).
- Type a card number to show masking, or “I need a doctor” to show the medical hand-over and emergency guidance.
- **Reset** at any time restores a clean demo.
