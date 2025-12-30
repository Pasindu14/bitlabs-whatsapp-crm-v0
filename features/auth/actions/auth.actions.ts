"use server";

import { withPublicAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { signIn } from "@/auth";

import {
    signInSchema,
    signUpSchema,
    type SignInData,
    type SignUpData,
} from "../schemas/auth.schema";
import { AuthService } from "../services/auth.service";
import type {
    SignInResult,
    SignUpResult,
} from "../types/auth.types";

/* ---------------------------------- */
/* Sign In (PUBLIC) */
/* ---------------------------------- */
export const signInAction = withPublicAction<
    SignInData,
    SignInResult
>(
    "auth.action.signIn",
    async (input) => {
        try {
            const result = await signIn("credentials", {
                email: input.email,
                password: input.password,
                redirect: false,
            });

            if (result?.error) {
                return Result.unauthorized("Invalid email or password");
            }

            return Result.ok(null, "Signed in successfully");
        } catch (error) {
            const err = error as Error;
            // Handle CredentialsSignin error from Auth.js
            if (err.name === "CredentialsSignin") {
                return Result.unauthorized("Invalid email or password");
            }
            // Re-throw other errors to be caught by the action wrapper
            throw error;
        }
    },
    {
        schema: signInSchema,
    }
);

/* ---------------------------------- */
/* Sign Up (PUBLIC) */
/* ---------------------------------- */
export const signUpAction = withPublicAction<
    SignUpData,
    SignUpResult
>(
    "auth.action.signUp",
    async (input) => {
        const result = await AuthService.signUp(input);

        if (!result.success) {
            return Result.fail(result.message);
        }

        return Result.ok(
            { userId: result.data!.user.id },
            "User created successfully"
        );
    },
    {
        schema: signUpSchema,
    }
);
