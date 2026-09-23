export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });

  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));

  await page.waitForSelector("canvas", { timeout: 40000 });
  await page.waitForFunction(
    () => document.querySelector(".z-\\[100\\]") === null,
    null,
    { timeout: 40000 },
  );
  await page.waitForTimeout(9000);

  await page.screenshot({ path: "e:/cars-showroom/final.png" });

  const state = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      heading: document.querySelector("h2")?.textContent ?? null,
      shown: (t.match(/(\d+) \/ (\d+) SHOWN/i) || [])[0] ?? null,
      crashed: /Application error/i.test(t),
      modelUnavailable: /MODEL UNAVAILABLE/i.test(t),
      // Diagnostics must be gone
      hasDiag: document.body.hasAttribute("data-diag"),
      hasFitDebug: document.body.hasAttribute("data-fit-debug"),
      hasModelErr: document.body.hasAttribute("data-model-error"),
      // Audio gone
      hasSoundToggle: /SOUND (OFF|ON)/i.test(t),
      // Footer gone
      hasFooterHint: /DRAG TO ORBIT/i.test(t),
      // Core UI
      swatches: document.querySelectorAll('button[aria-label^="Apply"]').length,
      deckEntries: document.querySelectorAll(
        "nav[aria-label='Vehicle selector'] button",
      ).length,
      cameraPresets: [...document.querySelectorAll("button")].filter((b) =>
        /FRONT AGGRESSIVE|SIDE PROFILE|COCKPIT FOCUS|REAR WING/.test(
          b.textContent || "",
        ),
      ).length,
    };
  });

  return { ...state, errors: errs.slice(0, 3) };
}
