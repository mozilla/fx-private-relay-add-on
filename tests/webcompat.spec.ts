import { tmpdir } from "os";
import { resolve as resolvePath } from "path";
import { test, expect, chromium, BrowserContext } from "@playwright/test";

let browserContext: BrowserContext;

test.beforeAll(async () => {
  const pathToExtension = resolvePath(__dirname, "../src");
  console.log({pathToExtension});
  const userDataDir = resolvePath(tmpdir(), "playwright-test-user-data-dir");
  console.log({userDataDir});
  process.exit(0);
  browserContext = await chromium.launchPersistentContext(userDataDir, {
    // Extensions only work in headed mode:
    headless: false,
    locale: "en-GB",
    timezoneId: "GMT",
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });
  console.log("Got browser context");
});

test.afterAll(async () => {
  await browserContext.close();
});

type PageWithEmail = {
  url: string;
  inputSelector?: string;
  visualRegressionThreshold?: number;
};

const pagesToTest: Record<string, PageWithEmail> = {
  google: {
    url: "https://accounts.google.com/?hl=en",
    inputSelector: "input[type=email]",
  },
  amazon: {
    url: "https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&",
    inputSelector: "input[type=email]",
  },
  yahoo: {
    url: "https://login.yahoo.com/?.lang=en-US",
    inputSelector: "input#login-username",
  },
  // Disable: Wikipedia has abuse-prevention mechanisms that block us:
  // wikipedia: {
  //   url: "https://en.wikipedia.org/w/index.php?title=Special:CreateAccount&returnto=Main+Page",
  //   inputSelector: "input[type=email]",
  // },
  zoom: {
    url: "https://zoom.us/signin",
  },
  substack: {
    url: "https://lunduke.substack.com",
    inputSelector: "input[type=email]",
  },
};

Object.keys(pagesToTest).forEach((id) => {
  const pageToTest = pagesToTest[id];
  test.describe(`Extension on ${id}`, () => {
    test("The menu can be opened", async () => {
      const page = await browserContext.newPage();
      await page.goto(pageToTest.url);
      expect(page.locator(".fx-relay-menu")).not.toBeVisible();
      await page.click("#fx-relay-button");
      expect(page.locator(".fx-relay-menu")).not.toBeVisible();
    });

    test("The email field is still editable and no extra characters (e.g. placeholders) remain when editing", async () => {
      const page = await browserContext.newPage();
      await page.goto(pageToTest.url);
      const inputEl = page
        .locator(pageToTest.inputSelector ?? "input[type=email]")
        .first();
      expect(inputEl).toBeEditable();
      await inputEl.type("newvalue@example.com");
      expect(await inputEl.inputValue()).toBe("newvalue@example.com");
    });

    test.describe("Visual regressions", () => {
      test("The email input", async () => {
        const page = await browserContext.newPage();
        await page.goto(pageToTest.url);
        // Some pages (e.g. Yahoo!'s) immediately focus the email,
        // then animate the placeholder turning into a label:
        await page.waitForTimeout(200);

        const inputEl = page
          .locator(pageToTest.inputSelector ?? "input[type=email]")
          .first();
        expect(await inputEl.screenshot()).toMatchSnapshot(
          resolvePath(__dirname, `screenshots/${id}/input.png`),
          { threshold: 0.2 }
        );
      });

      test("The in-page popup menu", async () => {
        const page = await browserContext.newPage();
        await page.goto(pageToTest.url);
        await page.click("#fx-relay-button");
        // The menu has an opening animation of 200ms:
        await page.waitForTimeout(200);

        expect(
          await page.locator(".fx-relay-menu").screenshot()
        ).toMatchSnapshot(
          resolvePath(__dirname, `screenshots/${id}/popup.png`),
          { threshold: 0.2 }
        );
      });
    });
  });
});
