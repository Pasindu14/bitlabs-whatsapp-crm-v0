"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useWebhookConfig, useUpsertWebhookConfig } from "../hooks/use-webhook-config";
import { webhookConfigUpsertClientSchema } from "../schemas/whatsapp-webhook-schema";
import {  ShieldCheck } from "lucide-react";

type WebhookConfigFormValues = z.infer<typeof webhookConfigUpsertClientSchema>;

interface WebhookConfigFormProps {
  whatsappAccountId: number;
  isDev?: boolean;
}

export function WebhookConfigForm({ whatsappAccountId, isDev = false }: WebhookConfigFormProps) {
  const { data: config, isLoading, error } = useWebhookConfig(whatsappAccountId);
  const upsertMutation = useUpsertWebhookConfig();

  const form = useForm<WebhookConfigFormValues>({
    resolver: zodResolver(webhookConfigUpsertClientSchema),
    defaultValues: {
      appSecret: "",
      callbackPath: "/api/webhooks/whatsapp",
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        appSecret: "••••••••••••••••••••••••",
        callbackPath: config.callbackPath,
      });
    }
  }, [config, form]);

  const onSubmit = async (values: WebhookConfigFormValues) => {
    await upsertMutation.mutateAsync({ ...values, whatsappAccountId });
  };


  const getCallbackUrl = () => {
    if (isDev) {
      return "https://your-ngrok-url.ngrok-free.app/api/webhooks/whatsapp";
    }
    return `${window.location.origin}/api/webhooks/whatsapp`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        Failed to load webhook configuration
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-[60vh]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure Meta WhatsApp webhook to receive incoming messages
              </CardDescription>
            </div>
            {config?.isActive && (
              <Badge className="bg-green-500 text-white">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4  min-w-4xl">
            <div className="space-y-2">
              <Label htmlFor="callbackPath">Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  id="callbackPath"
                  {...form.register("callbackPath")}
                  placeholder="/api/webhooks/whatsapp"
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isDev
                  ? "For development, run: ngrok http 3000 and update the URL above"
                  : "Production webhook endpoint"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret</Label>
              <Input
                id="appSecret"
                {...form.register("appSecret")}
                placeholder="Enter Meta app secret"
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                From your Meta app settings. Used for webhook signature verification.
              </p>
            </div>

            <Button
              type="submit"
              disabled={upsertMutation.isPending}
              className="w-full"
            >
              {upsertMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}
