"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWebhookEventLogs } from "../hooks/use-webhook-config";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface WebhookEventLogsProps {
  whatsappAccountId: number;
}

export function WebhookEventLogs({ whatsappAccountId }: WebhookEventLogsProps) {
  const [processedFilter, setProcessedFilter] = useState<boolean | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useWebhookEventLogs(
    whatsappAccountId,
    { limit: 20, processed: processedFilter }
  );

  const items = data?.pages.flatMap((page) => page.items) || [];

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getEventTypeBadge = (eventType: string) => {
    const config = {
      message: { variant: "default" as const, label: "Message", icon: CheckCircle2 },
      status: { variant: "secondary" as const, label: "Status", icon: Clock },
      other: { variant: "outline" as const, label: "Other", icon: XCircle },
    };
    const type = eventType as keyof typeof config;
    const { variant, label, icon: Icon } = config[type] || config.other;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getProcessedBadge = (processed: boolean) => {
    return processed ? (
      <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Processed
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading event logs...</div>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Failed to load event logs
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Event Logs</CardTitle>
            <CardDescription>History of incoming webhook events from Meta</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={processedFilter === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setProcessedFilter(undefined)}
            >
              All
            </Button>
            <Button
              variant={processedFilter === true ? "default" : "outline"}
              size="sm"
              onClick={() => setProcessedFilter(true)}
            >
              Processed
            </Button>
            <Button
              variant={processedFilter === false ? "default" : "outline"}
              size="sm"
              onClick={() => setProcessedFilter(false)}
            >
              Pending
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No webhook events found
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => toggleRow(item.id)}
                >
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    {expandedRows.has(item.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                    <div className="col-span-1">
                      {getEventTypeBadge(item.eventType)}
                    </div>
                    <div className="col-span-2 text-sm">
                      {format(new Date(item.eventTs), "MMM dd, yyyy HH:mm:ss")}
                    </div>
                    <div className="col-span-1 text-sm font-mono text-muted-foreground truncate">
                      {item.objectId || "-"}
                    </div>
                    <div className="col-span-1">
                      {getProcessedBadge(item.processed)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Event Payload</DialogTitle>
                            <DialogDescription>
                              Raw webhook payload from Meta
                            </DialogDescription>
                          </DialogHeader>
                          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                            {JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
                {expandedRows.has(item.id) && (
                  <div className="border-t p-4 bg-muted/30 space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Event ID:</span> {item.id}
                      </div>
                      <div>
                        <span className="font-medium">Dedup Key:</span> {item.dedupKey}
                      </div>
                      <div>
                        <span className="font-medium">Object ID:</span> {item.objectId || "-"}
                      </div>
                      <div>
                        <span className="font-medium">Signature:</span> {item.signature ? "Present" : "Missing"}
                      </div>
                      <div>
                        <span className="font-medium">Processed:</span>{" "}
                        {item.processed
                          ? `Yes (${item.processedAt ? format(new Date(item.processedAt), "HH:mm:ss") : "-"})`
                          : "No"}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span>{" "}
                        {format(new Date(item.createdAt), "MMM dd, yyyy HH:mm:ss")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
