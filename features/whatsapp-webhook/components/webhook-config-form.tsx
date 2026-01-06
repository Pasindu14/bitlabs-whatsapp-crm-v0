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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWebhookConfig, useUpsertWebhookConfig, useSetWebhookStatus } from "../hooks/use-webhook-config";
import { webhookConfigUpsertClientSchema } from "../schemas/whatsapp-webhook-schema";
import { Copy, RefreshCw, Shield, ShieldCheck, ShieldX, AlertCircle, ExternalLink } from "lucide-react";

type WebhookConfigFormValues = z.infer<typeof webhookConfigUpsertClientSchema>;

interface WebhookConfigFormProps {
  whatsappAccountId: number;
  isDev?: boolean;
}

export function WebhookConfigForm({ whatsappAccountId, isDev = false }: WebhookConfigFormProps) {
  const { data: config, isLoading, error } = useWebhookConfig(whatsappAccountId);
  const upsertMutation = useUpsertWebhookConfig();
  const setStatusMutation = useSetWebhookStatus();

  const form = useForm<WebhookConfigFormValues>({
    resolver: zodResolver(webhookConfigUpsertClientSchema),
    defaultValues: {
      appSecret: "",
      callbackPath: "/api/webhooks/whatsapp",
      status: "unverified",
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        appSecret: "",
        callbackPath: config.callbackPath,
        status: config.status,
      });
    }
  }, [config, form]);

  const onSubmit = async (values: WebhookConfigFormValues) => {
    await upsertMutation.mutateAsync({ ...values, whatsappAccountId });
  };

  const handleToggleStatus = async () => {
    if (!config) return;
    const newStatus = config.status === "disabled" ? "verified" : "disabled";
    await setStatusMutation.mutateAsync({ whatsappAccountId, status: newStatus });
  };

  const getCallbackUrl = () => {
    if (isDev) {
      return "https://your-ngrok-url.ngrok-free.app/api/webhooks/whatsapp";
    }
    return `${window.location.origin}/api/webhooks/whatsapp`;
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading webhook configuration...</div>;
  }

  if (error && !config) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load webhook configuration</AlertDescription>
      </Alert>
    );
  }

  const statusConfig = {
    unverified: { icon: Shield, color: "bg-yellow-500", label: "Unverified" },
    verified: { icon: ShieldCheck, color: "bg-green-500", label: "Verified" },
    disabled: { icon: ShieldX, color: "bg-gray-500", label: "Disabled" },
  };

  const currentStatus = config?.status || "unverified";
  const StatusIcon = statusConfig[currentStatus].icon;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure Meta WhatsApp webhook to receive incoming messages
              </CardDescription>
            </div>
            <Badge className={`${statusConfig[currentStatus].color} text-white`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[currentStatus].label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="callbackPath">Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  id="callbackPath"
                  {...form.register("callbackPath")}
                  placeholder="/api/webhooks/whatsapp"
                  disabled
                />
                <Button type="button" variant="outline" size="icon" asChild>
                  <a href={getCallbackUrl()} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
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

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={upsertMutation.isPending}
                className="flex-1"
              >
                {upsertMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
              {config && (
                <Button
                  type="button"
                  variant={currentStatus === "disabled" ? "default" : "outline"}
                  onClick={handleToggleStatus}
                  disabled={setStatusMutation.isPending}
                >
                  {currentStatus === "disabled" ? "Enable" : "Disable"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {isDev && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Development Mode:</strong> Run{" "}
            <code className="bg-muted px-1 py-0.5 rounded">ngrok http 3000</code>{" "}
            and use the generated URL as your webhook callback in Meta.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
