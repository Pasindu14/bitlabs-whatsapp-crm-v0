import NextAuth from "next-auth"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/db/drizzle"
import { usersTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verify } from "@node-rs/bcrypt"

declare module "next-auth" {
    interface User {
        id: string
        role?: string
        name?: string | null
        email?: string | null
        companyId?: number | null
    }
    interface Session {
        user: {
            id: string
            name?: string | null
            email?: string | null
            role?: string
            companyId?: number | null
        }
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                try {
                    // Validate input
                    if (!credentials?.email || !credentials?.password) {
                        return null
                    }

                    const email = (credentials.email as string).toLowerCase().trim()
                    const password = credentials.password as string

                    // Basic email validation
                    if (!email.includes('@') || password.length < 1) {
                        return null
                    }

                    const userRecord = await db.query.usersTable.findFirst({
                        where: eq(usersTable.email, email),
                    })


                    if (!userRecord || !userRecord.passwordHash) {
                        return null
                    }

                    const isValid = await verify(password, userRecord.passwordHash)
                    if (!isValid) {
                        return null
                    }

                    return {
                        id: String(userRecord.id),
                        email: userRecord.email,
                        name: userRecord.name,
                        role: userRecord.role,
                        companyId: userRecord.companyId,
                    }
                } catch (error) {
                    console.error("Auth error:", error)
                    return null
                }
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
    },
})