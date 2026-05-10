import { beforeEach, describe, expect, it, vi } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";
import type { SessionDO } from "../../src/session/durable-object";
import { IntegrationSettingsStore } from "../../src/db/integration-settings";
import { cleanD1Tables } from "./cleanup";
import { initNamedSession } from "./helpers";

describe("spawn-time slack-notify tool gate", () => {
  beforeEach(cleanD1Tables);

  it("does not install slack-notify when the repo is outside the Slack enabledRepos allowlist", async () => {
    const { stub } = await initNamedSession(`gate-${Date.now()}`, {
      repoOwner: "acme",
      repoName: "web-app",
    });

    const store = new IntegrationSettingsStore(env.DB);
    await store.setGlobal("slack", {
      enabledRepos: ["other/repo"],
      defaults: {
        agentNotificationsEnabled: true,
        mentionsPolicy: "allow",
      },
    });

    let createSandboxBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        createSandboxBody = init?.body ? JSON.parse(init.body as string) : undefined;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              sandbox_id: "sandbox-acme-web-app-test",
              modal_object_id: "modal-1",
              status: "warming",
              created_at: Date.now(),
            },
          }),
          { status: 200 }
        );
      })
    );

    await runInDurableObject(stub, async (instance: SessionDO) => {
      await (
        instance as unknown as { lifecycleManager: { spawnSandbox(): Promise<void> } }
      ).lifecycleManager.spawnSandbox();
    });

    expect(createSandboxBody?.agent_slack_notify_enabled).toBe(false);
  });
});
