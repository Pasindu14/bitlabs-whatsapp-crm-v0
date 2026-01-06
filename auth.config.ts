import type { NextAuthConfig } from "next-auth"

export default {
    providers: [],
    pages: {
        signIn: "/login",
        error: "/auth/error",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const userRole = auth?.user?.role
            const path = nextUrl.pathname

            // Redirect logged-in users away from login page
            if (path === "/login" && isLoggedIn) {
                return Response.redirect(new URL("/users", nextUrl))
            }

            // Protect dashboard routes
            if (path.startsWith("/users")) {
                if (!isLoggedIn) {
                    return Response.redirect(new URL("/sign-in", nextUrl))
                }
                // Only allow admin users to access dashboard
                if (userRole !== "admin") {
                    return Response.redirect(new URL("/unauthorized", nextUrl))
                }
                return true
            }

            // Allow all other routes
            return true
        },
        async jwt({ token, user }) {
            // On sign in, add user data to token
            if (user) {
                token.id = user.id
                token.role = user.role
                token.name = user.name
                token.email = user.email
                token.companyId = user.companyId
            }

            return token
        },
        async session({ session, token }) {
            // Ensure token data exists before assigning
            if (token) {
                session.user.id = token.id as string
                session.user.role = token.role as string || undefined
                session.user.name = token.name as string || null
                session.user.email = token.email as string
                session.user.companyId = token.companyId as number || null
            }
            return session
        },
    },
} satisfies NextAuthConfig