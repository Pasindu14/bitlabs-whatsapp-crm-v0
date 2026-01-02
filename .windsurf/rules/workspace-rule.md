Store>((set) => ({
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session })
}));
// Don't duplicate NextAuth state!
```

---

## 🚨 Error Handling

**Always throw errors in custom hooks when mutations fail.** If a service returns `{ success: false }`, throw an error with `throw new Error(result.error)`. React Query's error boundaries will catch it.

```typescript
// ✅ CORRECT: Throwing errors in hooks
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteProject } from '@/features/projects/delete-project-action';
import { toast } from 'sonner';

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await deleteProject(projectId);
      
      // Throw on failure so React Query error handling works
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onSuccess: () => {
      toast.success('Project deleted');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
}

// ❌ WRONG: Not throwing errors
'use client';

import { useMutation } from '@tanstack/react-query';
import { deleteProject } from '@/features/projects/delete-project-action';
import { toast } from 'sonner';

export function useDeleteProject() {
  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await deleteProject(projectId);
      
      // Don't just return the result!
      if (!result.success) {
        toast.error(result.error);
        return null; // This breaks error handling
      }
      
      return result.data;
    },
    onSuccess: () => {
      toast.success('Project deleted');
    }
  });
}
```

**Never use try-catch blocks in custom hooks.** React Query handles errors automatically through `onError` and error boundaries. Try-catch interferes with this flow.

```typescript
// ✅ CORRECT: Let React Query handle errors
'use client';

import { useMutation } from '@tanstack/react-query';
import { createTask } from '@/features/tasks/create-task-action';

export function useCreateTask() {
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const result = await createTask(input);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onError: (error: Error) => {
      // React Query automatically catches errors
      console.error('Task creation failed:', error);
    }
  });
}

// ❌ WRONG: try-catch in hook
'use client';

import { useMutation } from '@tanstack/react-query';
import { createTask } from '@/features/tasks/create-task-action';

export function useCreateTask() {
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      try {
        // Don't use try-catch!
        const result = await createTask(input);
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        return result.data;
      } catch (error) {
        // This breaks React Query's error handling
        console.error(error);
        return null;
      }
    }
  });
}
```

**Never expose internal error details to users.** Transform technical errors into user-friendly messages in service methods before returning them.

```typescript
// ✅ CORRECT: User-friendly error messages
export class PaymentService {
  static async processPayment(params: ProcessPaymentParams): Promise<Result<Payment>> {
    const logger = createPerformanceLogger('PaymentService.processPayment');

    try {
      const payment = await stripeClient.charges.create({
        amount: params.amount,
        currency: 'usd',
        source: params.token
      });

      logger.end();
      return { success: true, data: payment };
    } catch (error) {
      logger.end();
      
      // Transform to user-friendly messages
      if (error.type === 'StripeCardError') {
        return { success: false, error: 'Your card was declined' };
      }
      if (error.type === 'StripeInvalidRequestError') {
        return { success: false, error: 'Payment information is invalid' };
      }
      if (error.type === 'StripeAPIError') {
        return { success: false, error: 'Payment service temporarily unavailable' };
      }
      
      return { success: false, error: 'Payment processing failed' };
    }
  }
}

// ❌ WRONG: Exposing technical errors
export class PaymentService {
  static async processPayment(params: ProcessPaymentParams): Promise<Result<Payment>> {
    try {
      const payment = await stripeClient.charges.create({
        amount: params.amount,
        currency: 'usd',
        source: params.token
      });

      return { success: true, data: payment };
    } catch (error) {
      // Don't expose technical details!
      return { 
        success: false, 
        error: error.message // "Stripe API connection timeout at 192.168.1.1:443"
      };
    }
  }
}
```

---

## 📊 Logging & Monitoring

**Always log mutations with audit trails.** Use `AuditLogService.log()` to record who did what, when, and in which company context.

```typescript
// ✅ CORRECT: Comprehensive audit logging
export class InvoiceService {
  static async update(params: {
    invoiceId: string;
    companyId: string;
    userId: string;
    updates: Partial<Invoice>;
  }): Promise<Result<Invoice>> {
    const logger = createPerformanceLogger('InvoiceService.update');

    try {
      const oldInvoice = await db.invoice.findUnique({
        where: { id: params.invoiceId, companyId: params.companyId }
      });

      if (!oldInvoice) {
        return { success: false, error: 'Invoice not found' };
      }

      const invoice = await db.invoice.update({
        where: { id: params.invoiceId, companyId: params.companyId },
        data: params.updates
      });

      // Log the mutation with before/after state
      await AuditLogService.log({
        companyId: params.companyId,
        userId: params.userId,
        action: 'invoice.updated',
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: {
          before: oldInvoice,
          after: invoice,
          changes: params.updates
        }
      });

      logger.end();
      return { success: true, data: invoice };
    } catch (error) {
      logger.end();
      return { success: false, error: 'Failed to update invoice' };
    }
  }
}

// ❌ WRONG: No audit logging
export class InvoiceService {
  static async update(params: {
    invoiceId: string;
    companyId: string;
    updates: Partial<Invoice>;
  }): Promise<Result<Invoice>> {
    const invoice = await db.invoice.update({
      where: { id: params.invoiceId, companyId: params.companyId },
      data: params.updates
    });

    // Forgot to log!
    return { success: true, data: invoice };
  }
}
```

**Always use performance logging for service methods.** Wrap service logic with `createPerformanceLogger()` to track execution time and identify slow operations.

```typescript
// ✅ CORRECT: Performance logging
export class AnalyticsService {
  static async generateDashboard(params: {
    companyId: string;
    dateRange: { start: Date; end: Date };
  }): Promise<Result<Dashboard>> {
    const logger = createPerformanceLogger('AnalyticsService.generateDashboard');

    try {
      // Complex query that might be slow
      const sales = await db.sale.findMany({
        where: {
          companyId: params.companyId,
          createdAt: {
            gte: params.dateRange.start,
            lte: params.dateRange.end
          }
        },
        include: {
          customer: true,
          items: true
        }
      });

      const metrics = this.calculateMetrics(sales);
      const charts = this.generateCharts(sales);

      logger.end(); // Logs: "AnalyticsService.generateDashboard completed in 1234ms"
      return {
        success: true,
        data: { metrics, charts }
      };
    } catch (error) {
      logger.end();
      return { success: false, error: 'Failed to generate dashboard' };
    }
  }

  private static calculateMetrics(sales: Sale[]) {
    const logger = createPerformanceLogger('AnalyticsService.calculateMetrics');
    // Heavy computation
    const result = /* ... */;
    logger.end();
    return result;
  }
}

// ❌ WRONG: No performance tracking
export class AnalyticsService {
  static async generateDashboard(params: {
    companyId: string;
    dateRange: { start: Date; end: Date };
  }): Promise<Result<Dashboard>> {
    // No way to know if this is slow!
    const sales = await db.sale.findMany({
      where: {
        companyId: params.companyId,
        createdAt: {
          gte: params.dateRange.start,
          lte: params.dateRange.end
        }
      }
    });

    const metrics = this.calculateMetrics(sales);
    return { success: true, data: { metrics } };
  }
}
```

**Never skip audit logging for data changes.** Every create, update, and delete must be logged. This is required for compliance and debugging.

```typescript
// ✅ CORRECT: All mutations logged
export class CustomerService {
  static async create(params: CreateCustomerParams): Promise<Result<Customer>> {
    const customer = await db.customer.create({ data: params });
    
    await AuditLogService.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'customer.created',
      entityType: 'customer',
      entityId: customer.id
    });
    
    return { success: true, data: customer };
  }

  static async update(params: UpdateCustomerParams): Promise<Result<Customer>> {
    const customer = await db.customer.update({
      where: { id: params.customerId },
      data: params.updates
    });
    
    await AuditLogService.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'customer.updated',
      entityType: 'customer',
      entityId: customer.id,
      metadata: params.updates
    });
    
    return { success: true, data: customer };
  }

  static async delete(params: DeleteCustomerParams): Promise<Result<void>> {
    await db.customer.delete({
      where: { id: params.customerId, companyId: params.companyId }
    });
    
    await AuditLogService.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'customer.deleted',
      entityType: 'customer',
      entityId: params.customerId
    });
    
    return { success: true, data: undefined };
  }
}

// ❌ WRONG: Inconsistent logging
export class CustomerService {
  static async create(params: CreateCustomerParams): Promise<Result<Customer>> {
    const customer = await db.customer.create({ data: params });
    
    await AuditLogService.log({ /* ... */ }); // ✓ Logged
    
    return { success: true, data: customer };
  }

  static async update(params: UpdateCustomerParams): Promise<Result<Customer>> {
    const customer = await db.customer.update({
      where: { id: params.customerId },
      data: params.updates
    });
    
    // ✗ Forgot to log!
    return { success: true, data: customer };
  }

  static async delete(params: DeleteCustomerParams): Promise<Result<void>> {
    await db.customer.delete({
      where: { id: params.customerId }
    });
    
    // ✗ Forgot to log!
    return { success: true, data: undefined };
  }
}
```

**Never skip performance logging for potentially slow operations.** Log database queries, external API calls, and complex computations to identify performance issues early.

```typescript
// ✅ CORRECT: All potentially slow operations logged
export class ExportService {
  static async exportToCSV(params: {
    companyId: string;
    entityType: string;
  }): Promise<Result<string>> {
    const logger = createPerformanceLogger('ExportService.exportToCSV');

    try {
      // Database query
      const dbLogger = createPerformanceLogger('ExportService.fetchData');
      const data = await db[params.entityType].findMany({
        where: { companyId: params.companyId }
      });
      dbLogger.end();

      // CSV generation
      const csvLogger = createPerformanceLogger('ExportService.generateCSV');
      const csv = this.convertToCSV(data);
      csvLogger.end();

      // S3 upload
      const uploadLogger = createPerformanceLogger('ExportService.uploadToS3');
      const url = await s3.upload(csv);
      uploadLogger.end();

      logger.end();
      return { success: true, data: url };
    } catch (error) {
      logger.end();
      return { success: false, error: 'Export failed' };
    }
  }
}

// ❌ WRONG: No performance visibility
export class ExportService {
  static async exportToCSV(params: {
    companyId: string;
    entityType: string;
  }): Promise<Result<string>> {
    // Which part is slow? Database? CSV? Upload? No idea!
    const data = await db[params.entityType].findMany({
      where: { companyId: params.companyId }
    });
    
    const csv = this.convertToCSV(data);
    const url = await s3.upload(csv);
    
    return { success: true, data: url };
  }
}
```

---

## 📁 Code Organization

**Always use kebab-case for all file names.** Name files like `user-service.ts`, `create-user-schema.ts`, `use-users-query.ts`, not camelCase or PascalCase.

```
// ✅ CORRECT: kebab-case files
src/
  features/
    projects/
      schemas/
        create-project-schema.ts
        update-project-schema.ts
        project-query-schema.ts
      services/
        project-service.ts
      actions/
        create-project-action.ts
        update-project-action.ts
        delete-project-action.ts
        get-projects-action.ts
      hooks/
        use-projects-query.ts
        use-create-project.ts
        use-update-project.ts
        use-delete-project.ts
      components/
        project-list.tsx
        project-card.tsx
        project-form.tsx

// ❌ WRONG: Mixed naming conventions
src/
  features/
    projects/
      schemas/
        CreateProjectSchema.ts  // PascalCase
        updateProjectSchema.ts  // camelCase
        project_query_schema.ts // snake_case
      services/
        ProjectService.ts       // PascalCase
      actions/
        createProject.ts        // camelCase
      hooks/
        useProjectsQuery.ts     // camelCase
```

**Always organize code by feature, not by type.** Group related files (schemas, services, actions, hooks) in feature folders like `features/users/` instead of separating by layer.

```
// ✅ CORRECT: Feature-based organization
src/
  features/
    users/
      schemas/
        create-user-schema.ts
        update-user-schema.ts
      services/
        user-service.ts
      actions/
        create-user-action.ts
        get-users-action.ts
      hooks/
        use-users-query.ts
        use-create-user.ts
      components/
        user-list.tsx
        user-form.tsx
    projects/
      schemas/
        create-project-schema.ts
      services/
        project-service.ts
      actions/
        create-project-action.ts
      hooks/
        use-projects-query.ts
      components/
        project-list.tsx

// ❌ WRONG: Type-based organization
src/
  schemas/
    user-schemas.ts
    project-schemas.ts
    task-schemas.ts
  services/
    user-service.ts
    project-service.ts
    task-service.ts
  actions/
    user-actions.ts
    project-actions.ts
  hooks/
    user-hooks.ts
    project-hooks.ts
  components/
    users/
      user-list.tsx
    projects/
      project-list.tsx
```

**Never mix concerns in a single file.** Keep schemas, services, actions, and hooks in separate files. Each file should have a single, clear responsibility.

```typescript
// ✅ CORRECT: Separated concerns

// features/tasks/schemas/create-task-schema.ts
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional()
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// features/tasks/services/task-service.ts
export class TaskService {
  static async create(params: CreateTaskParams): Promise<Result<Task>> {
    // Implementation
  }
}

// features/tasks/actions/create-task-action.ts
'use server';
export async function createTask(input: unknown) {
  return withAction(async ({ session }) => {
    // Implementation
  });
}

// features/tasks/hooks/use-create-task.ts
'use client';
export function useCreateTask() {
  return useMutation({
    mutationFn: createTask
  });
}

// ❌ WRONG: Everything in one file
// features/tasks/tasks.ts
'use client';
'use server'; // Can't have both!

import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';

// Schema
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200).trim()
});

// Service
export class TaskService {
  static async create(params: any) {
    // Implementation
  }
}

// Action
export async function createTask(input: unknown) {
  // Implementation
}

// Hook
export function useCreateTask() {
  return useMutation({
    mutationFn: createTask
  });
}
```

---

## 📅 Date Handling

**Always use date-fns for date operations.** Use date-fns functions like `format()`, `parseISO()`, `addDays()` for all date formatting, parsing, and arithmetic.

```typescript
// ✅ CORRECT: Using date-fns
import { format, parseISO, addDays, isAfter, differenceInDays } from 'date-fns';

export class InvoiceService {
  static async create(params: CreateInvoiceParams): Promise<Result<Invoice>> {
    // Parse ISO date string
    const issueDate = parseISO(params.issueDateISO);
    
    // Calculate due date (30 days from issue)
    const dueDate = addDays(issueDate, 30);
    
    const invoice = await db.invoice.create({
      data: {
        companyId: params.companyId,
        issueDate,
        dueDate,
        amount: params.amount
      }
    });

    return { success: true, data: invoice };
  }

  static isOverdue(invoice: Invoice): boolean {
    const now = new Date();
    return isAfter(now, invoice.dueDate);
  }

  static getDaysUntilDue(invoice: Invoice): number {
    const now = new Date();
    return differenceInDays(invoice.dueDate, now);
  }
}

// Component
export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  return (
    <div>
      <p>Issue Date: {format(invoice.issueDate, 'MMM dd, yyyy')}</p>
      <p>Due Date: {format(invoice.dueDate, 'MMM dd, yyyy')}</p>
      <p>Days until due: {InvoiceService.getDaysUntilDue(invoice)}</p>
    </div>
  );
}

// ❌ WRONG: Native Date methods
export class InvoiceService {
  static async create(params: CreateInvoiceParams): Promise<Result<Invoice>> {
    // Don't use Date constructor with strings!
    const issueDate = new Date(params.issueDateISO);
    
    // Don't use setDate!
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    
    const invoice = await db.invoice.create({
      data: {
        companyId: params.companyId,
        issueDate,
        dueDate,
        amount: params.amount
      }
    });

    return { success: true, data: invoice };
  }
}

// Component
export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  return (
    <div>
      {/* Don't use toLocaleDateString! */}
      <p>Issue Date: {invoice.issueDate.toLocaleDateString()}</p>
      <p>Due Date: {invoice.dueDate.toLocaleDateString()}</p>
    </div>
  );
}
```

**Never use native Date methods for formatting.** Don't use `Date.prototype.toLocaleDateString()` or similar methods. Use date-fns's `format()` with locale support instead.

```typescript
// ✅ CORRECT: date-fns formatting
import { format } from 'date-fns';
import { enUS, es, fr } from 'date-fns/locale';

export function TaskCard({ task, locale }: { task: Task; locale: string }) {
  const localeMap = { en: enUS, es, fr };
  
  return (
    <div>
      <p>
        Created: {format(task.createdAt, 'PPP', { locale: localeMap[locale] })}
      </p>
      <p>
        Due: {format(task.dueDate, 'MMM dd, yyyy')}
      </p>
      <p>
        Time: {format(task.createdAt, 'h:mm a')}
      </p>
      <p>
        Relative: {format(task.createdAt, 'yyyy-MM-dd')}
      </p>
    </div>
  );
}

// ❌ WRONG: Native formatting
export function TaskCard({ task }: { task: Task }) {
  return (
    <div>
      {/* Inconsistent across browsers and locales! */}
      <p>Created: {task.createdAt.toLocaleDateString()}</p>
      <p>Due: {task.dueDate.toDateString()}</p>
      <p>Time: {task.createdAt.toLocaleTimeString()}</p>
      <p>ISO: {task.createdAt.toISOString()}</p>
    </div>
  );
}
```

**Always use ISO 8601 format for date storage.** Store dates as ISO strings in the database and parse them with date-fns when displaying.

```typescript
// ✅ CORRECT: ISO format in database
import { format, parseISO } from 'date-fns';

export class EventService {
  static async create(params: {
    companyId: string;
    userId: string;
    name: string;
    startDate: Date;
    endDate: Date;
  }): Promise<Result<Event>> {
    const event = await db.event.create({
      data: {
        companyId: params.companyId,
        name: params.name,
        // Store as ISO string
        startDate: params.startDate.toISOString(),
        endDate: params.endDate.toISOString()
      }
    });

    return { success: true, data: event };
  }

  static async get(eventId: string): Promise<Result<Event>> {
    const event = await db.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // Parse ISO strings back to Dates
    return {
      success: true,
      data: {
        ...event,
        startDate: parseISO(event.startDate),
        endDate: parseISO(event.endDate)
      }
    };
  }
}

// Component
export function EventCard({ event }: { event: Event }) {
  // Parse and format
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);

  return (
    <div>
      <p>Start: {format(startDate, 'MMM dd, yyyy h:mm a')}</p>
      <p>End: {format(endDate, 'MMM dd, yyyy h:mm a')}</p>
    </div>
  );
}

// ❌ WRONG: Inconsistent date storage
export class EventService {
  static async create(params: {
    companyId: string;
    name: string;
    startDate: Date;
  }): Promise<Result<Event>> {
    const event = await db.event.create({
      data: {
        companyId: params.companyId,
        name: params.name,
        // Storing raw Date object or formatted string - inconsistent!
        startDate: params.startDate.toString(), // "Mon Jan 01 2024 10:00:00"
        // or
        startDate: params.startDate.toLocaleDateString() // "1/1/2024"
      }
    });

    return { success: true, data: event };
  }
}
```

---

## ✨ Summary

This application follows a **strict layered architecture** with multi-tenancy as the foundation. Every layer—from database queries to UI components—must respect company boundaries. Services contain business logic and return Result objects. Actions are thin adapters that use the withAction wrapper. React Query manages server state while Zustand handles client state. All dates use date-fns, all styling uses Tailwind, and all code follows consistent naming conventions.

**Key principles:**
- **Security first**: Every query filters by `companyId`
- **Type safety**: Zod schemas with inferred types
- **Clear separation**: Services for logic, actions for API, hooks for state
- **Consistent patterns**: Result<T>, cursor pagination, audit logging
- **Modern tooling**: React Query, Zustand, date-fns, Tailwind, shadcn/ui

Follow these patterns exactly to maintain consistency, security, and developer experience across the codebase.

---
```