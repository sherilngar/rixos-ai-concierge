import { expect, test, type Page } from '@playwright/test';
import { boardCard, freshStart, sendGuest, signIn, watchConsole } from './helpers';

const COPY = {
  en: {
    multi:
      'The AC is quite loud, could you send two extra towels, and book a table at the Beach Grill for 8 tonight?',
    party: 'Two of us',
    partyQ: 'How many guests will be joining?',
    booked: /requested a table at The Beach Grill/,
    dining: "Could I order a club sandwich and a fresh orange juice? I'm allergic to nuts.",
    readBack: 'Let me repeat your order:',
    yes: 'Yes, please',
    placed: /Your order is placed/,
    accepted: 'Engineering has accepted your request',
    rate: 'Rate this service',
    recovery: /fell short/,
    star2: '2 out of 5',
  },
  ar: {
    multi: 'التكييف صوته عالي، ممكن منشفتين وحجز طاولة في مشويات الشاطئ الساعة ٨ الليلة',
    party: 'شخصين',
    partyQ: 'كم عدد الضيوف؟',
    booked: /طلبت لك طاولة في مشويات الشاطئ/,
    dining: 'أبغى كلوب ساندويتش وعصير برتقال، عندي حساسية من المكسرات',
    readBack: 'دعني أكرر طلبك:',
    yes: 'نعم',
    placed: /تم تأكيد طلبك/,
    accepted: 'قبل فريق الهندسة والصيانة طلبك',
    rate: 'قيّم هذه الخدمة',
    recovery: /لم نكن عند حسن ظنك/,
    star2: '2 من 5',
  },
} as const;

async function openStaff(page: Page) {
  const staff = await page.context().newPage();
  await staff.goto('/#/staff');
  await staff.locator('label', { hasText: 'Rooms Controller' }).click();
  await staff.locator('#pin').fill('1234');
  await staff.getByRole('button', { name: /Sign in as/ }).click();
  await staff.getByRole('tab', { name: /All departments/ }).click();
  return staff;
}

for (const lang of ['en', 'ar'] as const) {
  const c = COPY[lang];
  test.describe(`Guest scenarios in ${lang === 'en' ? 'English' : 'Arabic'}`, () => {
    test.beforeEach(async ({ page }) => {
      await freshStart(page);
      await signIn(page);
      if (lang === 'ar') {
        await page.getByRole('button', { name: /Switch to Arabic/ }).click();
        await expect(page.getByTestId('guest-app')).toHaveAttribute('dir', 'rtl');
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      }
    });

    test('multi-request message becomes several tickets on the live board', async ({ page }) => {
      const noErrors = watchConsole(page);
      const staff = await openStaff(page);
      await sendGuest(page, c.multi);
      await expect(page.getByText(c.partyQ).last()).toBeVisible();
      await expect(boardCard(staff, 'Air conditioning')).toContainText('Noisy');
      await expect(boardCard(staff, 'Extra towels')).toContainText('2 ×');
      await sendGuest(page, c.party);
      await expect(page.getByText(c.booked).last()).toBeVisible();
      await expect(boardCard(staff, 'Table reservation')).toContainText('2 guests');
      // Staff action reaches the guest's phone.
      await boardCard(staff, 'Air conditioning').locator('[data-action="accept"]').click();
      await expect(page.getByText(c.accepted).last()).toBeVisible();
      noErrors();
    });

    test('in-room dining order is read back and placed only after yes', async ({ page }) => {
      const noErrors = watchConsole(page);
      const staff = await openStaff(page);
      await sendGuest(page, c.dining);
      await expect(page.getByText(c.readBack).last()).toBeVisible();
      await expect(
        staff.locator('[data-ticket]').filter({ hasText: 'In-room dining order' }),
      ).toHaveCount(0);
      await sendGuest(page, c.yes);
      await expect(page.getByText(c.placed).last()).toBeVisible();
      await expect(boardCard(staff, 'In-room dining order')).toContainText('ALLERGY: nuts');
      noErrors();
    });

    test('unaccepted ticket escalates to supervisor, then Rooms Controller', async ({ page }) => {
      const noErrors = watchConsole(page);
      const staff = await openStaff(page);
      await sendGuest(page, c.dining);
      await sendGuest(page, c.yes);
      const card = boardCard(staff, 'In-room dining order');
      await expect(card).toHaveAttribute('data-escalation', '0');
      const present = await page.context().newPage();
      await present.goto('/#/present');
      const plus = present.getByRole('button', { name: '+1 min' });
      for (let i = 0; i < 4; i++) await plus.click();
      await expect(card).toHaveAttribute('data-escalation', '1');
      await expect(card).toContainText('IRD Supervisor');
      for (let i = 0; i < 3; i++) await plus.click();
      await expect(card).toHaveAttribute('data-escalation', '2');
      await expect(card).toContainText('Rooms Controller');
      await staff.getByRole('tab', { name: /Rooms Controller/ }).click();
      await expect(boardCard(staff, 'In-room dining order')).toBeVisible();
      noErrors();
    });

    test('low rating opens a service-recovery ticket and a person takes over', async ({ page }) => {
      const noErrors = watchConsole(page);
      const staff = await openStaff(page);
      await sendGuest(page, c.multi);
      await boardCard(staff, 'Air conditioning').locator('[data-action="done"]').click();
      await expect(page.getByText(c.rate).last()).toBeVisible();
      await page.getByRole('radio', { name: c.star2 }).click();
      await expect(page.getByText(c.recovery).last()).toBeVisible();
      const recovery = boardCard(staff, 'Service recovery');
      await expect(recovery).toContainText(/high/i);
      await recovery.getByRole('button', { name: /Open/ }).click();
      await staff.getByTestId('staff-reply').fill('I am so sorry, I am coming up to see you now.');
      await staff.getByRole('button', { name: 'Send reply' }).click();
      await expect(
        page.getByText('I am so sorry, I am coming up to see you now.').last(),
      ).toBeVisible();
      await expect(page.getByTestId('mode-banner')).toContainText('Sherif');
      noErrors();
    });
  });
}

test('Arabic message gets an Arabic reply and English tickets with the original attached', async ({
  page,
}) => {
  const noErrors = watchConsole(page);
  await freshStart(page);
  await signIn(page);
  const staff = await openStaff(page);
  await sendGuest(page, 'ممكن مخدتين إضافيتين وتنظيف الغرفة الساعة ٣ العصر؟');
  await expect(page.getByText(/بالتأكيد يا Sarah/).last()).toBeVisible();
  const pillows = boardCard(staff, 'Pillows (pillow menu)');
  await expect(pillows).toContainText('2 ×');
  await pillows.getByRole('button', { name: /Open/ }).click();
  await expect(staff.getByText('Original guest message').last()).toBeVisible();
  await expect(
    staff
      .getByRole('dialog')
      .getByText(/مخدتين/)
      .first(),
  ).toBeVisible();
  noErrors();
});

test('services grid, privacy masking and emergency guidance', async ({ page }) => {
  const noErrors = watchConsole(page);
  await freshStart(page);
  await signIn(page);
  await sendGuest(page, 'My card is 4111 1111 1111 1111');
  await expect(page.getByText('Number hidden for your safety').last()).toBeVisible();
  await expect(page.getByText('4111 1111 1111 1111')).toHaveCount(0);
  await sendGuest(page, 'There is smoke in the corridor');
  await expect(page.getByText('Emergency guidance').last()).toBeVisible();
  await page.getByRole('button', { name: 'Services' }).click();
  await page.getByRole('button', { name: 'Housekeeping' }).click();
  await page.getByRole('button', { name: 'Bath robes' }).click();
  await page.getByRole('button', { name: '+' }).click();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(/sent this to our Housekeeping team/).last()).toBeVisible();
  await page.getByRole('button', { name: 'My requests' }).click();
  await expect(page.getByTestId('requests').getByText('2 × Bath robes').last()).toBeVisible();
  noErrors();
});
