import { useMutation } from "@tanstack/react-query";
import { signInAction } from "../actions/auth.actions";
import type { SignInData } from "../schemas/auth.schema";

export function useSignIn() {
  return useMutation({
    mutationFn: async (data: SignInData) => {
      const result = await signInAction(data);
      if (!result.success) {
        throw new Error(result.message || "Failed to sign in");
      }
      return result.data;
    },
  });
}
