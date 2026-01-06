"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { signInSchema, type SignInData } from "../schemas/auth.schema";
import { useSignIn } from "../hooks/use-sign-in";
import { Spinner } from "@/components/ui/spinner";

export default function SignInForm() {
  const router = useRouter();

  const form = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const mutation = useSignIn();

  // This wraps mutate and passes validated form values
  const onSubmit = (data: SignInData): void => {
    mutation.mutate(data, {
      onSuccess: () => {
        toast.success("Signed in successfully");
        // Redirect to dashboard after successful login
        router.push("/users");
      },
      onError: (error: Error) => {
        toast.error(error.message || "Something went wrong");
      },
    });
  };

  const isPending: boolean = mutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* ✅ REQUIRED - Error state check FIRST */}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="" {...field} disabled={isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Password"
                  {...field}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className=" w-full " disabled={isPending}>
          {isPending ? <Spinner /> : "Sign In"}
        </Button>
        <div className=" bottom-6 text-xs opacity-75">
          © Bitlabs WhatsApp CRM
        </div>
      </form>
    </Form>
  );
}
