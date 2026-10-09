import { getChatGPTUser } from "@/app/chatgpt-auth";
import { accountDatabase } from "@/db";
import { readAccount, writeAccount } from "@/lib/account-store";
import { emptyPlanner, plannerSchema } from "@/lib/planner";
import { z } from "zod";
export const dynamic = "force-dynamic";
const MAX = 1_000_000;
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return reply({ error: "Sign in to open your account workspace." }, 401);
  try {
    const row = await readAccount(accountDatabase(), user.userId);
    return reply({
      plan: row ? plannerSchema.parse(JSON.parse(row.body)) : emptyPlanner(),
      revision: row?.revision ?? 0,
      updatedAt: row?.updated_at ?? null,
    });
  } catch {
    console.error("Account workspace read failed");
    return reply(
      {
        error:
          "Account storage is unavailable. Retry without changing your browser workspace.",
      },
      503,
    );
  }
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return reply(
      {
        error: "Your sign-in expired. Back up this draft, then sign in again.",
      },
      401,
    );
  // Browser writes require same-origin JSON; dispatcher supplies the trusted user identity.
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ error: "Request not accepted." }, 403);
  let text = "";
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing workspace." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX) {
        await reader.cancel();
        return reply(
          {
            error:
              "Account workspace exceeds 1 MB. Keep a backup and reduce saved content.",
          },
          413,
        );
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    text = new TextDecoder().decode(bytes);
  } catch {
    return reply({ error: "Workspace could not be read." }, 400);
  }
  const input = z
    .object({
      plan: plannerSchema,
      revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    })
    .strict()
    .safeParse(
      (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
    );
  if (!input.success)
    return reply({ error: "Workspace format is invalid." }, 400);
  try {
    const row = await writeAccount(
      accountDatabase(),
      user.userId,
      JSON.stringify(input.data.plan),
      input.data.revision,
    );
    if (!row)
      return reply(
        {
          error:
            "Another tab or device saved a newer version. Back up your draft, then reload the account workspace. Nothing was overwritten.",
        },
        409,
      );
    return reply({ revision: row.revision, updatedAt: row.updated_at });
  } catch {
    console.error("Account workspace save failed");
    return reply(
      {
        error:
          "Save could not be confirmed. Keep this page open or back up your draft before retrying.",
      },
      503,
    );
  }
}
