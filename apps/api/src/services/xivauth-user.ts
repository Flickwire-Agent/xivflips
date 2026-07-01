import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users, xivauthAccounts, xivauthCharacters, type UserRow } from "../db/schema.js";
import { badRequest, serviceUnavailable } from "../http/errors.js";
import {
  exchangeCode,
  requireXivauthConfig,
  verifyState,
  xivauthRequest,
  type XivauthCharacterResponse,
  type XivauthUserResponse,
} from "./xivauth-client.js";

export type XivauthLoginResult = {
  user: UserRow;
};

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function upsertCharacters(userId: string, characters: XivauthCharacterResponse[]) {
  const db = getDb();
  for (const character of characters) {
    await db
      .insert(xivauthCharacters)
      .values({
        userId,
        persistentKey: character.persistent_key,
        lodestoneId: character.lodestone_id,
        name: character.name,
        homeWorld: character.home_world,
        dataCenter: character.data_center,
        avatarUrl: character.avatar_url ?? null,
        portraitUrl: character.portrait_url ?? null,
        verifiedAt: parseOptionalDate(character.verified_at),
      })
      .onConflictDoUpdate({
        target: xivauthCharacters.persistentKey,
        set: {
          userId,
          lodestoneId: character.lodestone_id,
          name: character.name,
          homeWorld: character.home_world,
          dataCenter: character.data_center,
          avatarUrl: character.avatar_url ?? null,
          portraitUrl: character.portrait_url ?? null,
          verifiedAt: parseOptionalDate(character.verified_at),
          updatedAt: new Date(),
        },
      });
  }
}

export async function completeXivauthLogin(
  code: string,
  stateToken: string,
): Promise<XivauthLoginResult> {
  requireXivauthConfig();
  const state = await verifyState(stateToken);
  const token = await exchangeCode(code);
  const [xivauthUser, characters] = await Promise.all([
    xivauthRequest<XivauthUserResponse>("/api/v1/user", token.access_token),
    xivauthRequest<XivauthCharacterResponse[]>("/api/v1/characters", token.access_token),
  ]);
  const db = getDb();

  const [existingAccount] = await db
    .select()
    .from(xivauthAccounts)
    .where(eq(xivauthAccounts.xivauthUserId, xivauthUser.id))
    .limit(1);

  if (state.mode === "link" && state.userId) {
    const [linkedElsewhere] = await db
      .select()
      .from(xivauthAccounts)
      .where(
        and(
          eq(xivauthAccounts.xivauthUserId, xivauthUser.id),
          ne(xivauthAccounts.userId, state.userId),
        ),
      )
      .limit(1);
    if (linkedElsewhere) badRequest("That XIVAuth account is already linked to another user");
  }

  let user: UserRow | undefined;
  const targetUserId = state.mode === "link" ? state.userId : existingAccount?.userId;
  if (targetUserId) {
    [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  }

  if (!user) {
    const displayName = characters[0]?.name ?? null;
    [user] = await db
      .insert(users)
      .values({
        subject: `xivauth:${xivauthUser.id}`,
        email: xivauthUser.email ?? null,
        displayName,
      })
      .returning();
  }

  if (!user) serviceUnavailable("Unable to create XIVAuth user");

  await db
    .insert(xivauthAccounts)
    .values({ userId: user.id, xivauthUserId: xivauthUser.id, email: xivauthUser.email ?? null })
    .onConflictDoUpdate({
      target: xivauthAccounts.xivauthUserId,
      set: { userId: user.id, email: xivauthUser.email ?? null, updatedAt: new Date() },
    });

  await upsertCharacters(user.id, characters);

  return { user };
}
