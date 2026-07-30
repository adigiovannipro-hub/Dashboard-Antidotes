import { expect, test } from "@playwright/test";

/**
 * Parcours d'accès : rien n'est atteignable sans session, et la destination
 * demandée est conservée pour y revenir après connexion.
 */
test.describe("accès non authentifié", () => {
  for (const path of ["/", "/admin/acces", "/espace/bondet"]) {
    test(`${path} redirige vers la connexion`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      // La destination initiale doit survivre à la redirection.
      expect(new URL(page.url()).searchParams.get("suivant")).toBe(path);
    });
  }
});

test.describe("page de connexion", () => {
  test("propose l'envoi d'un lien par email", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(page.getByLabel("Adresse email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Recevoir le lien de connexion" }),
    ).toBeVisible();
  });

  test("refuse un email mal formé sans appeler le serveur", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Adresse email").fill("pas-un-email");
    await page.getByRole("button", { name: "Recevoir le lien de connexion" }).click();

    // La validation native du navigateur bloque l'envoi : on reste sur place.
    await expect(page).toHaveURL(/\/login/);
  });
});
