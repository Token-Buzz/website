import { test, expect } from '@playwright/test'

/**
 * Smoke test for the public marketing site.
 *
 * Only asserts against stable, env-independent pages/elements:
 *  - homepage (`/`) hero + primary CTA
 *  - the `/contact` page (renders client-side; the form is NOT submitted, since
 *    submitting needs Turnstile + Resend)
 *  - the `/coming-soon` page (static, linked sitewide from the footer)
 *
 * Avoided on purpose: `/changelog` (fetches GitHub releases at request time via
 * CHANGELOG_GITHUB_TOKEN) and the contact form submit (Turnstile/Resend).
 */
test.describe('marketing smoke', () => {
  test('homepage loads with hero heading and primary CTA', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    // Hero display copy ("Hear the market before you see it." split across lines).
    await expect(page.getByText('Hear', { exact: false }).first()).toBeVisible()

    // Primary hero CTA — an anchor styled as a button, pointing at the pricing
    // section. The same CTA copy reappears lower on the page, so scope to the first.
    const startCta = page.getByRole('link', { name: 'Start tracking — free' }).first()
    await expect(startCta).toBeVisible()
    await expect(startCta).toHaveAttribute('href', '#pricing')
  })

  test('main navigation renders with brand and links', async ({ page }) => {
    await page.goto('/')

    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()

    // Sitewide nav links that are present in the DOM on every render.
    await expect(nav.getByRole('link', { name: 'Features' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pricing' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Changelog' })).toHaveAttribute('href', '/changelog')
  })

  test('footer is present with copyright', async ({ page }) => {
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible()
    await expect(footer.getByText(/TokenBuzz Inc\./i)).toBeVisible()
  })

  test('footer Contact link navigates to the contact page', async ({ page }) => {
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    await footer.getByRole('link', { name: 'Contact' }).click()

    await expect(page).toHaveURL(/\/contact$/)
    await expect(page.getByRole('heading', { name: 'Get in touch' })).toBeVisible()
  })

  test('coming-soon page renders its heading', async ({ page }) => {
    const response = await page.goto('/coming-soon')
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: /coming\s*soon/i })).toBeVisible()
  })
})
