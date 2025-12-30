import { SignInData, SignUpData } from "../schemas/auth.schema";
import { db } from "@/db/drizzle";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Result } from "@/lib/result";
import { createPerformanceLogger } from "@/lib/logger";
import bcrypt from "bcrypt";

type SafeUser = Omit<typeof usersTable.$inferSelect, "passwordHash">;

const toError = (e: unknown): Error =>
    e instanceof Error ? e : new Error(String(e));

export class AuthService {
    static async signIn(
        data: SignInData
    ): Promise<Result<{ user: SafeUser }>> {
        const perf = createPerformanceLogger("auth.service.signIn");

        try {
          const email = data.email.toLowerCase().trim();

          const user = await db.query.usersTable.findFirst({
            where: eq(usersTable.email, email),
        });

          if (!user) {
            perf.fail("user_not_found");
            return Result.fail("Invalid email or password");
        }

          const valid = await bcrypt.compare(
              data.password,
              user.passwordHash
          );

          if (!valid) {
              perf.fail("invalid_password");
              return Result.fail("Invalid email or password");
          }

          const { passwordHash, ...safeUser } = user;

          perf.complete(1, { userId: user.id });
          return Result.ok({ user: safeUser }, "Signed in");
      } catch (e) {
          perf.fail("unexpected_error");

          return Result.fail(
              "Failed to sign in",
              {
                  code: "INTERNAL_ERROR",
                  details: {
                      message: e instanceof Error ? e.message : String(e),
                  },
              }
          );
      }

    }

    static async signUp(
        data: SignUpData
    ): Promise<Result<{ user: SafeUser }>> {
        const perf = createPerformanceLogger("auth.service.signUp");

        try {
          const email = data.email.toLowerCase().trim();

          const exists = await db.query.usersTable.findFirst({
              where: eq(usersTable.email, email),
              columns: { id: true },
          });

          if (exists) {
              perf.fail("email_exists");
              return Result.fail("Email already in use");
          }

          const passwordHash = await bcrypt.hash(data.password, 12);

          const [user] = await db
              .insert(usersTable)
            .values({
                name: data.name.trim(),
                email,
                passwordHash,
                companyId: 1,
            })
            .returning();

          const { passwordHash: _, ...safeUser } = user;

          perf.complete(1, { userId: user.id });
          return Result.ok(
              { user: safeUser },
              "User created successfully"
          );
      } catch (e) {
          perf.fail("unexpected_error");

          return Result.fail(
              "Failed to create user",
              {
                  code: "INTERNAL_ERROR",
                  details: {
                      message: e instanceof Error ? e.message : String(e),
                  },
              }
  );
      }

    }
}
