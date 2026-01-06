"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Webhook, History } from "lucide-react";
import Link from "next/link";
import { WebhookConfigForm } from "@/features/whatsapp-webhook/components/webhook-config-form";
import { WebhookEventLogs } from "@/features/whatsapp-webhook/components/webhook-event-logs";

export default function WhatsappAccountDetailPage() {
  const params = useParams();
  const accountId = parseInt(params.id as string);
  const isDev = process.env.NODE_ENV === "development";

  const [activeTab, setActiveTab] = useState("webhook");

  return (
    <div className="px-10 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/whatsapp-accounts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              WhatsApp Account Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure webhook and manage account settings
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="webhook" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhook Configuration
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" />
            Event Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhook" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meta Webhook Setup</CardTitle>
              <CardDescription>
                Configure your WhatsApp Business API webhook to receive incoming messages and status updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhookConfigForm whatsappAccountId={accountId} isDev={isDev} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <WebhookEventLogs whatsappAccountId={accountId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
