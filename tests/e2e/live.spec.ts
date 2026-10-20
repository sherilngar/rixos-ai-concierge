import { expect, test, type Page } from '@playwright/test';
import { boardCard, freshStart, sendGuest, signIn, watchConsole } from './helpers';

async function openStaffView(page: Page, view: 'requests' | 'chats' | 'guests') {
  const staff = await page.context().newPage();
  await staff.setViewportSize({ width: 1440, height: 900 });
  await staff.goto('/#/staff');
  await staff.locator('#pin').fill('1234');
  await staff.getByRole('button', { name: /Sign in as/ }).click();
  await staff.getByTestId(`view-${view}`).click();
  return staff;
}

test.describe('Guest sign-in', () => {
  test('checks room, surname and consent, then welcomes the guest', async ({ page }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    await page.goto('/#/guest');
    await expect(page.getByTestId('guest-sign-in')).toBeVisible();

    await page.locator('#si-room').fill('1207');
    await page.locator('#si-surname').fill('Smith');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /^Start/ }).click();
    await expect(page.getByRole('alert')).toContainText("couldn't find a current stay");

    await page.locator('#si-surname').fill('  mitchell ');
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: /^Start/ }).click();
    await expect(page.getByRole('alert')).toContainText('privacy note');

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /^Start/ }).click();
    await expect(page.getByTestId('guest-greeting')).toContainText('Sarah');
    await expect(page.getByText(/Welcome to Rixos Bab Al Bahr, Sarah/).last()).toBeVisible();

    // Stays signed in after a reload, and signs out cleanly.
    await page.reload();
    await expect(page.getByTestId('guest-greeting')).toContainText('Sarah');
    await page.getByTestId('guest-sign-out').click();
    await expect(page.getByTestId('guest-sign-in')).toBeVisible();
    noErrors();
  });

  test('the room number from a QR code is filled in, and Arabic works before sign-in', async ({
    page,
  }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    await page.goto('/#/guest?room=0412');
    await expect(page.locator('#si-room')).toHaveValue('0412');
    await page.getByRole('button', { name: /Switch to Arabic/ }).click();
    await expect(page.getByTestId('guest-sign-in')).toHaveAttribute('dir', 'rtl');
    await page.locator('#si-surname').fill('Rahman');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /ابدأ/ }).click();
    await expect(page.getByTestId('guest-app')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText(/أهلاً بك في ريكسوس باب البحر يا Omar/).last()).toBeVisible();
    noErrors();
  });

  test('front office adds a guest who can then sign in; check-out ends access', async ({
    page,
  }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    const staff = await openStaffView(page, 'guests');
    await staff.locator('#ng-first').fill('Layla');
    await staff.locator('#ng-last').fill('Haddad');
    await staff.locator('#ng-room').fill('808');
    await staff.getByTestId('add-guest').click();
    await expect(staff.getByRole('status').filter({ hasText: 'can now sign in' })).toBeVisible();

    // Same room twice is refused.
    await staff.locator('#ng-first').fill('Someone');
    await staff.locator('#ng-last').fill('Else');
    await staff.locator('#ng-room').fill('808');
    await staff.getByTestId('add-guest').click();
    await expect(staff.getByRole('alert')).toContainText('already has an in-house guest');

    await signIn(page, '808', 'haddad');
    await expect(page.getByTestId('guest-greeting')).toContainText('Layla');

    await staff
      .getByTestId('guest-row')
      .filter({ hasText: 'Haddad' })
      .getByRole('button', { name: 'Check out' })
      .click();
    await expect(page.getByTestId('guest-sign-in')).toBeVisible();
    await expect(page.getByText('Your stay has ended')).toBeVisible();
    noErrors();
  });
});

test.describe('Guest chats for staff', () => {
  test('each guest sees only their own chat and requests', async ({ page }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    await signIn(page, '1207', 'Mitchell');
    await sendGuest(page, 'Two extra towels please');

    const other = await page.context().newPage();
    await other.setViewportSize(page.viewportSize() ?? { width: 390, height: 844 });
    await signIn(other, '0918', 'Okafor');
    await sendGuest(other, 'Can I get a baby cot?');

    await expect(other.getByText('Two extra towels please')).toHaveCount(0);
    await expect(page.getByText('Can I get a baby cot?')).toHaveCount(0);
    await other.getByRole('button', { name: 'My requests' }).click();
    await expect(other.getByTestId('requests')).toContainText('Baby cot');
    await expect(other.getByTestId('requests')).not.toContainText('Extra towels');
    noErrors();
  });

  test('staff reply, take over, the AI stays quiet, then hand back', async ({ page }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    await signIn(page, '0412', 'Rahman');
    await sendGuest(page, 'This is unacceptable, the shower is broken');
    await expect(page.getByTestId('mode-banner')).toContainText('has been notified');

    const staff = await openStaffView(page, 'requests');
    await expect(staff.getByTestId('view-chats')).toContainText('1');
    await staff.getByTestId('view-chats').click();
    const item = staff.getByTestId('chat-item').filter({ hasText: 'Rahman' });
    await expect(item).toHaveAttribute('data-needs-person', 'true');
    await item.click();

    await staff
      .getByTestId('staff-reply')
      .fill('So sorry, Mr Rahman. An engineer is on the way now.');
    await staff.getByTestId('staff-send').click();
    await expect(page.getByText('An engineer is on the way now.').last()).toBeVisible();
    await expect(page.getByTestId('mode-banner')).toContainText("You're chatting with Sherif");

    // While a person is in charge, the guest's messages reach staff and the AI stays quiet.
    await page.getByTestId('guest-input').fill('Thank you, how long will it take?');
    await page.getByTestId('guest-send').click();
    await expect(staff.getByTestId('staff-chat-log')).toContainText('how long will it take?');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-sender="ai"]').last()).not.toContainText('how long');
    await expect(page.getByTestId('typing')).toHaveCount(0);

    await staff.getByTestId('hand-back').click();
    await expect(page.getByTestId('mode-banner')).toContainText('AI concierge');
    await sendGuest(page, 'Could I have two pillows?');
    await expect(page.locator('[data-sender="ai"]').last()).toContainText('Of course');
    noErrors();
  });

  test('staff can message a guest first from the ticket drawer', async ({ page }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    await signIn(page, '1207', 'Mitchell');
    await sendGuest(page, 'Please send two bath robes');
    const staff = await openStaffView(page, 'requests');
    await staff.getByRole('tab', { name: /All departments/ }).click();
    const card = staff.locator('[data-ticket]').filter({ hasText: 'Bath robes' }).last();
    await card.getByRole('button', { name: /Open/ }).click();
    await staff.getByTestId('staff-reply').fill('Hello Ms Mitchell, the robes are on their way.');
    await staff.getByTestId('staff-send').click();
    await expect(page.getByText('the robes are on their way.').last()).toBeVisible();
    noErrors();
  });
});

test('a guest cancelling in chat cancels the ticket on the staff board', async ({ page }) => {
  const noErrors = watchConsole(page);
  await freshStart(page);
  await signIn(page);
  await sendGuest(page, 'Could you send two extra towels please?');
  const staff = await openStaffView(page, 'requests');
  await staff.getByRole('tab', { name: /All departments/ }).click();
  const card = boardCard(staff, 'Extra towels');
  await expect(card).toHaveAttribute('data-status', 'new');

  await sendGuest(page, 'Please cancel the towels');
  await expect(page.getByText(/I've cancelled/).last()).toBeVisible();
  await expect(card).toHaveCount(0);
  noErrors();
});
