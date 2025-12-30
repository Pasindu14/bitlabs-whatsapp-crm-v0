"use client";
import { Logo } from "@/components/logo";
import { FloatingPaths } from "@/components/floating-paths";
import SignInForm from "@/features/auth/components/sign-in-form";
import { ShieldCheck } from "lucide-react";

export default function Page() {
  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      {/* Left Side - Animation Container */}
      <div className="relative hidden h-full flex-col border-r bg-secondary p-10 lg:flex dark:bg-secondary/20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <Logo className="mr-auto h-5" />

        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl">
              &ldquo;This Platform has helped me to save time and serve my
              clients faster than ever before.&rdquo;
            </p>
            <footer className="font-mono font-semibold text-sm">
              ~ Ali Hassan
            </footer>
          </blockquote>
        </div>
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
        <div
          aria-hidden
          className="-z-10 absolute inset-0 isolate opacity-60 contain-strict"
        >
          <div className="-translate-y-87.5 absolute top-0 right-0 h-320 w-140 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
          <div className="absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="-translate-y-87.5 absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
        </div>

        <div className="w-full max-w-md space-y-8 text-center border border-dashed p-8 lg:max-w-lg">
          {/* Logo - Hidden on large screens (shown in left sidebar) */}
          <div className="flex justify-center lg:hidden">
            <Logo className="h-12" />
          </div>

          {/* Application Title */}
          <div className="relative hidden md:flex flex-col items-center justify-center gap-4 to-primary p-8">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-6 w-6" />
              Secure Access
            </div>

            <h2 className="text-3xl font-bold leading-tight">
              Manage conversations <br /> smarter & faster
            </h2>

            <p className="text-sm opacity-90 max-w-sm">
              Centralize WhatsApp conversations, automate workflows, and keep
              your team productive with enterprise-grade security.
            </p>
          </div>

          {/* Sign In Form */}
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
