from pathlib import Path
from playwright.sync_api import sync_playwright


OUTPUT_DIR = Path(r"c:\Scripts\Projects\mti-alert-hub\tmp\wellness-ui-probe")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1200})

        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))

        page.goto("http://127.0.0.1:8080/wellness-programs/new", wait_until="networkidle")
        page.screenshot(path=str(OUTPUT_DIR / "01-initial.png"), full_page=True)

        # Capture top-level state before any auth redirect handling.
        state = {
            "title": page.title(),
            "url": page.url,
            "body_text": page.locator("body").inner_text()[:4000],
        }

        # If already inside the app, interact with the form.
        template_trigger = page.locator("button[role='combobox']").first
        if "wellness" in page.url.lower() and template_trigger.count() > 0:
            template_trigger.click()
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUTPUT_DIR / "02-template-open.png"), full_page=True)

            option = page.get_by_role("option", name="B1 - Office Stretching Hero Start Card")
            if option.count() > 0:
                option.click()
                page.wait_for_timeout(500)
                page.screenshot(path=str(OUTPUT_DIR / "03-template-b1-selected.png"), full_page=True)

            rotation_boxes = page.locator("button[role='combobox']")
            if rotation_boxes.count() >= 2:
                rotation_boxes.nth(1).click()
                page.wait_for_timeout(300)
                random_option = page.get_by_role("option", name="Shuffle")
                if random_option.count() > 0:
                    random_option.click()
                    page.wait_for_timeout(500)
                    page.screenshot(path=str(OUTPUT_DIR / "04-rotation-shuffle.png"), full_page=True)

        (OUTPUT_DIR / "console.txt").write_text("\n".join(console_messages), encoding="utf-8")
        (OUTPUT_DIR / "state.txt").write_text(
            "\n".join(
                [
                    f"title={state['title']}",
                    f"url={state['url']}",
                    "",
                    state["body_text"],
                ]
            ),
            encoding="utf-8",
        )

        browser.close()


if __name__ == "__main__":
    main()
