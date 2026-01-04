"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  whatsappAccountCreateClientSchema,
  whatsappAccountUpdateClientSchema,
  type WhatsappAccountCreateInput,
  type WhatsappAccountUpdateInput,
} from "../schemas/whatsapp-account.schema";

type WhatsappAccountFormValues =
  | (WhatsappAccountCreateInput & { id?: number })
  | (WhatsappAccountUpdateInput & { id: number });

interface WhatsappAccountFormProps {
  defaultValues?: Partial<WhatsappAccountFormValues>;
  onSubmit: (values: WhatsappAccountFormValues) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

export function WhatsappAccountForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading = false,
  isEdit = false,
}: WhatsappAccountFormProps) {
  const schema = isEdit
    ? whatsappAccountUpdateClientSchema
    : whatsappAccountCreateClientSchema;

  const form = useForm<WhatsappAccountFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      name: "",
      phoneNumberId: "",
      businessAccountId: "",
      accessToken: "",
      webhookUrl: "",
      isDefault: false,
      ...(defaultValues || {}),
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: "",
        phoneNumberId: "",
        businessAccountId: "",
        accessToken: "",
        webhookUrl: "",
        isDefault: false,
        ...defaultValues,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const error = form.formState.errors;
  console.log(error);
  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values);
        })}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Support Line" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneNumberId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number ID</FormLabel>
              <FormControl>
                <Input placeholder="1234567890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="businessAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Account ID</FormLabel>
              <FormControl>
                <Input placeholder="987654321" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access Token</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="webhookUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webhook URL (optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/webhook" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="w-full rounded-md border px-3 py-3">
                <div className="flex items-center space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      Set as default sending account
                    </FormLabel>
                  </div>
                </div>
              </FormItem>
            )}
          />

          {isEdit && (
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="w-full rounded-md border px-3 py-3">
                  <div className="flex items-center space-x-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? true}
                        onCheckedChange={(checked) => field.onChange(!!checked)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Active
                      </FormLabel>
                    </div>
                  </div>
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save changes" : "Create account"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
