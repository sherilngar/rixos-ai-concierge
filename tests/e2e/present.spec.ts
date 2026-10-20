import { expect, test } from '@playwright/test';
import { boardCard, freshStart, watchConsole } from './helpers';

test.describe('Present mode guided demo', () => {
  test.skip(({ isMobile }) => !!isMobile, 'Present mode is a desktop split screen');

  test('plays every scenario with the phone and board in sync', async ({ page }) => {
    const noErrors = watchConsole(page);
    await freshStart(page);
    await page.goto('/#/present');
    const next = page.getByTestId('demo-next');
    const phone = page.locator('[data-phone]');
    const board = page.locator('[data-board]');
    const step = async (last = false) => {
      await next.click();
      if (last)
        await expect(page.getByTestId('demo-narration')).toContainText('full journey', {
          timeout: 45_000,
        });
      else await expect(next).toBeEnabled({ timeout: 45_000 });
    };

    // 1. One message → three departments, with a clarifying question.
    await step();
    await expect(phone.getByText('How many guests will be joining?').last()).toBeVisible();
    await expect(boardCard(board, 'Air conditioning')).toBeVisible();
    await expect(boardCard(board, 'Extra towels')).toBeVisible();
    await expect(boardCard(board, 'Table reservation')).toContainText('The Beach Grill');
    await expect(board.locator('[data-dept-lane="engineering"]')).toBeVisible();

    // 2. Departments respond; the guest is updated.
    await step();
    await expect(
      phone.getByText('Engineering has accepted your request: Air conditioning.').last(),
    ).toBeVisible();
    await expect(boardCard(board, 'Extra towels')).toHaveAttribute('data-status', 'on_the_way');

    // 3. Dining order is read back and only placed after "yes".
    await step();
    await expect(
      phone.getByText('Let me repeat your order:', { exact: false }).last(),
    ).toBeVisible();
    await expect(phone.getByText(/Your order is placed, Sarah/).last()).toBeVisible();
    await expect(boardCard(board, 'In-room dining order')).toContainText('ALLERGY: nuts');

    // 4. Escalation to the Rooms Controller when nobody accepts.
    await step();
    const order = boardCard(board, 'In-room dining order');
    await expect(order).toHaveAttribute('data-escalation', '2');
    await expect(order).toHaveAttribute('data-status', 'accepted');

    // 5. Low rating opens service recovery and a person takes over.
    await step();
    await expect(boardCard(board, 'Service recovery')).toBeVisible();
    await expect(phone.getByTestId('mode-banner')).toContainText("You're chatting with Nadia");
    await expect(phone.getByText(/I'm on my way up now/).last()).toBeVisible();

    // 6. Arabic, right to left; staff still get English tickets.
    await step(true);
    await expect(phone.getByTestId('guest-app')).toHaveAttribute('dir', 'rtl');
    await expect(phone.getByText(/بالتأكيد يا Sarah/).last()).toBeVisible();
    await expect(boardCard(board, 'Pillows (pillow menu)')).toContainText('2 ×');
    await expect(boardCard(board, 'Room cleaning')).toContainText('AR');

    await expect(page.getByTestId('demo-narration')).toContainText('full journey');
    noErrors();
  });
});
