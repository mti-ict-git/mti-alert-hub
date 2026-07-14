from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import Page, Route, expect, sync_playwright


ROOT = Path("/Users/widjis/Documents/Projects/mti-alert-hub")
BASE_URL = "http://127.0.0.1:8087"
API_BASE = "http://127.0.0.1:4999"
SCREENSHOT_DIR = ROOT / "tmp" / "browser-validation"


def json_response(route: Route, body: object, status: int = 200) -> None:
    route.fulfill(
        status=status,
        headers={"Content-Type": "application/json"},
        body=json.dumps(body),
    )


def select_radix_option(page: Page, label: str, option_text: str | None = None) -> str:
    field = page.locator(f"label:text-is('{label}')").locator("xpath=following::button[@role='combobox'][1]")
    field.click()
    options = page.locator("[role='option']")
    expect(options.first).to_be_visible()
    if option_text is None:
        chosen_text = (options.first.text_content() or "").strip()
        options.first.click()
        return chosen_text

    option = page.get_by_role("option", name=option_text, exact=True)
    expect(option).to_be_visible()
    option.click()
    return option_text


def main() -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    console_messages: list[str] = []
    title = f"Browser Reminder Validation {datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    message = "Stretch, hydrate, and confirm workstation readiness."
    valid_until = (datetime.now().astimezone() + timedelta(days=7)).replace(second=0, microsecond=0)
    valid_until_local = valid_until.strftime("%Y-%m-%dT%H:%M")

    workflow = {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Reminder Confirmation",
        "allowFreeText": False,
        "requireFreeText": False,
        "escalationTimeoutMinutes": None,
        "escalationMode": "RecipientOnly",
        "responseImpliesAck": True,
        "options": [{"key": "done", "label": "Acknowledged"}],
    }

    state: dict[str, object] = {
        "communication": None,
    }

    def handle_api(route: Route) -> None:
        request = route.request
        path = request.url.replace(API_BASE, "")

        if path == "/auth/login" and request.method == "POST":
            json_response(
                route,
                {
                    "sessionToken": "browser-validation-token",
                    "user": {
                        "id": "admin-1",
                        "username": "widji.santoso",
                        "fullName": "Widji Santoso",
                        "email": "widji.santoso@merdekabattery.com",
                        "roleType": "CentralAdmin",
                    },
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat(),
                },
            )
            return

        if path == "/auth/me" and request.method == "GET":
            json_response(
                route,
                {
                    "sessionToken": "browser-validation-token",
                    "user": {
                        "id": "admin-1",
                        "username": "widji.santoso",
                        "fullName": "Widji Santoso",
                        "email": "widji.santoso@merdekabattery.com",
                        "roleType": "CentralAdmin",
                    },
                    "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat(),
                },
            )
            return

        if path == "/templates" and request.method == "GET":
            json_response(route, {"items": []})
            return

        if path == "/workflows?page=1&pageSize=200" and request.method == "GET":
            json_response(route, {"items": [workflow]})
            return

        if path == "/reference/organization" and request.method == "GET":
            json_response(route, {"sites": [], "areas": [], "departments": [], "sections": []})
            return

        if path == "/employees?page=1&pageSize=200" and request.method == "GET":
            json_response(route, {"items": []})
            return

        if path == "/devices?page=1&pageSize=200" and request.method == "GET":
            json_response(
                route,
                {
                    "items": [
                        {
                            "id": "device-1",
                            "primaryEmployeeId": None,
                            "deviceIdentifier": "device-mti-ops-01",
                            "hostname": "MTI-OPS-01",
                            "siteId": "site-1",
                            "areaId": None,
                            "locationLabel": "Control Room",
                            "ownershipMode": "LocationOwned",
                            "agentVersion": "1.0.0",
                            "lastHeartbeatAt": datetime.now(timezone.utc).isoformat(),
                            "lastConnectionAt": datetime.now(timezone.utc).isoformat(),
                            "status": "Online",
                        }
                    ]
                },
            )
            return

        if path == "/communications" and request.method == "POST":
            payload = request.post_data_json
            communication = {
                "id": "comm-browser-validation-1",
                "communicationType": payload["communicationType"],
                "priority": payload["priority"],
                "title": payload["title"],
                "body": payload["body"],
                "status": "Draft",
                "category": payload["category"],
                "scheduledAt": None,
                "templateId": None,
                "templateVersion": None,
                "channelSelections": payload["channelSelections"],
                "requiresResponse": False,
                "workflow": None,
                "schedule": None,
                "targets": payload["targets"],
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
            state["communication"] = communication
            json_response(route, communication, status=201)
            return

        if path == "/communications/comm-browser-validation-1" and request.method == "GET":
            json_response(route, state["communication"])
            return

        if path == "/communications/comm-browser-validation-1/audience-preview" and request.method == "POST":
            json_response(
                route,
                {
                    "totalRecipients": 1,
                    "deviceRecipients": 1,
                    "whatsappRecipients": 0,
                    "previewWarnings": [],
                    "channelPlan": [
                        {
                            "channel": "WindowsAgent",
                            "strategy": "Direct delivery to Windows Agent",
                            "plannedDelaySeconds": 0,
                        }
                    ],
                    "recipients": [
                        {
                            "recipientType": "Device",
                            "employeeId": None,
                            "employeeNumber": None,
                            "deviceId": "device-1",
                            "fullName": "MTI Control Room",
                            "siteName": "Main Site",
                            "areaName": None,
                            "departmentName": None,
                            "sectionName": None,
                            "availableChannels": ["WindowsAgent"],
                        }
                    ],
                },
            )
            return

        if path == "/communications/comm-browser-validation-1/deliveries?page=1&pageSize=200" and request.method == "GET":
            json_response(
                route,
                {
                    "items": [],
                    "recipients": [],
                    "events": [],
                    "page": {"page": 1, "pageSize": 200, "totalItems": 0, "totalPages": 1},
                },
            )
            return

        if path == "/communications/comm-browser-validation-1/responses?page=1&pageSize=200" and request.method == "GET":
            json_response(
                route,
                {"items": [], "page": {"page": 1, "pageSize": 200, "totalItems": 0, "totalPages": 1}},
            )
            return

        if path == "/communications/comm-browser-validation-1/publish" and request.method == "POST":
            payload = request.post_data_json
            communication = dict(state["communication"])
            communication["status"] = "Scheduled"
            communication["schedule"] = {
                "scheduleType": "Recurring",
                "scheduledAt": payload["scheduledAt"] or datetime.now(timezone.utc).isoformat(),
                "recurrenceRule": payload["recurrenceRule"],
                "timezone": payload["timezone"],
                "executionMode": payload["executionMode"],
                "scheduleVersion": 1,
                "validFrom": datetime.now(timezone.utc).isoformat(),
                "validUntil": payload["validUntil"],
                "isActive": True,
            }
            communication["updatedAt"] = datetime.now(timezone.utc).isoformat()
            state["communication"] = communication
            json_response(route, communication)
            return

        if path == "/communications/comm-browser-validation-1/reminder-activity" and request.method == "GET":
            communication = state["communication"]
            schedule = communication["schedule"] if communication else None
            json_response(
                route,
                {
                    "policies": [
                        {
                            "policyId": "policy-1",
                            "deviceId": "device-1",
                            "deviceIdentifier": "device-mti-ops-01",
                            "hostname": "MTI-OPS-01",
                            "scheduleVersion": 1,
                            "recurrenceRule": schedule["recurrenceRule"] if schedule else "FREQ=DAILY;INTERVAL=1",
                            "timezone": schedule["timezone"] if schedule else "Asia/Jakarta",
                            "validFrom": schedule["validFrom"] if schedule else datetime.now(timezone.utc).isoformat(),
                            "validUntil": schedule["validUntil"] if schedule else None,
                            "isActive": True,
                            "lastSyncedAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat(),
                        }
                    ],
                    "events": [
                        {
                            "eventId": "event-1",
                            "policyId": "policy-1",
                            "deviceId": "device-1",
                            "deviceIdentifier": "device-mti-ops-01",
                            "hostname": "MTI-OPS-01",
                            "eventType": "Triggered",
                            "occurredAt": datetime.now(timezone.utc).isoformat(),
                            "reportedAt": datetime.now(timezone.utc).isoformat(),
                            "activeUserIdentifier": "widji.santoso",
                            "metadata": {"source": "browser-mock"},
                        }
                    ],
                },
            )
            return

        route.abort()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        page.route(f"{API_BASE}/**", handle_api)

        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("heading", name="Sign in")).to_be_visible()
        page.screenshot(path=str(SCREENSHOT_DIR / "01-login.png"), full_page=True)

        page.locator("#u").fill("widji.santoso")
        page.locator("#p").fill("Orangef0x")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Sign out")).to_be_visible()

        page.goto(f"{BASE_URL}/notifications/new")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("heading", name="Create Notification")).to_be_visible()

        page.get_by_placeholder("e.g. Fire Alarm at Acid Plant").fill(title)
        page.get_by_placeholder("Describe the situation clearly and concisely.").fill(message)
        select_radix_option(page, "Content Type", "Reminder")
        expect(page.get_by_text("Hybrid Reminder Draft")).to_be_visible()
        page.get_by_role("radio", name="Device").click()
        chosen_device = select_radix_option(page, "Target Device")
        page.screenshot(path=str(SCREENSHOT_DIR / "02-reminder-draft.png"), full_page=True)

        create_button = page.get_by_role("button", name="Create Draft")
        expect(create_button).to_be_enabled()
        create_button.click()
        expect(page.get_by_role("heading", name="Confirm Reminder Draft")).to_be_visible()
        page.get_by_role("button", name="Confirm").click()

        page.wait_for_url(re.compile(r".*/notifications/comm-browser-validation-1$"))
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(SCREENSHOT_DIR / "03-reminder-detail.png"), full_page=True)
        expect(page.get_by_text(title).first).to_be_visible()
        button_texts = [text.strip() for text in page.locator("button").all_text_contents()]
        if "Publish" not in button_texts:
            raise AssertionError(
                f"Publish button not found on detail page. URL={page.url} buttons={button_texts}"
            )

        page.get_by_role("button", name="Publish").click()
        expect(page.get_by_role("heading", name="Publish Communication")).to_be_visible()
        page.get_by_role("radio", name="Publish a recurring reminder with explicit execution mode").click()
        expect(page.get_by_text("Reminder Publish Summary")).to_be_visible()

        select_radix_option(page, "Execution Mode", "AgentLocalRoutine")
        publish_button = page.get_by_role("button", name="Publish Recurring Reminder")
        expect(page.get_by_text("AgentLocalRoutine Guardrails")).to_be_visible()
        initially_disabled = publish_button.is_disabled()

        page.locator("label:text-is('Valid Until')").locator("xpath=following::input[1]").fill(valid_until_local)
        page.wait_for_timeout(500)
        enabled_after_valid_until = publish_button.is_enabled()
        page.screenshot(path=str(SCREENSHOT_DIR / "04-reminder-publish-dialog.png"), full_page=True)

        if not enabled_after_valid_until:
            raise AssertionError("Publish button stayed disabled after filling required recurring reminder fields.")

        publish_button.evaluate("(element) => element.click()")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Reminder Schedule")).to_be_visible()
        page.get_by_role("tab", name=re.compile(r"^Reminder Activity")).click()
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Reminder Policies")).to_be_visible()
        page.screenshot(path=str(SCREENSHOT_DIR / "05-reminder-activity.png"), full_page=True)

        result = {
            "baseUrl": BASE_URL,
            "apiBase": API_BASE,
            "createdTitle": title,
            "chosenDevice": chosen_device,
            "publishInitiallyDisabled": initially_disabled,
            "publishEnabledAfterValidUntil": enabled_after_valid_until,
            "currentUrl": page.url,
            "screenshots": [
                str(SCREENSHOT_DIR / "01-login.png"),
                str(SCREENSHOT_DIR / "02-reminder-draft.png"),
                str(SCREENSHOT_DIR / "03-reminder-detail.png"),
                str(SCREENSHOT_DIR / "04-reminder-publish-dialog.png"),
                str(SCREENSHOT_DIR / "05-reminder-activity.png"),
            ],
            "consoleMessages": console_messages[-20:],
        }
        print(json.dumps(result, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
