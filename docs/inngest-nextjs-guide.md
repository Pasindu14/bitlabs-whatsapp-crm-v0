# Inngest with Next.js - Complete Guide

## Overview

Inngest is a reliability layer for modern applications that enables serverless event-driven queues, background jobs, and scheduled jobs. It provides durable execution, automatic retries, and bypasses Vercel's execution time limits.

### Key Benefits

- **Durable Execution**: Functions survive server failures and restarts
- **Automatic Retries**: Built-in retry logic with exponential backoff
- **Event-Driven**: Trigger functions by sending events
- **Time Limits**: Bypass Vercel's 10-60s limits (up to 24 hours)
- **Observability**: Full dashboard for monitoring executions
- **Zero Infrastructure**: Runs on Vercel without additional setup

---

## Architecture

### How It Works

`

  Your App   
  (Next.js)  

       
        1. Send Event
           { name: "event.name", data: {...} }
       

   Inngest   
   (Cloud)   

       
        2. Trigger Function
           via HTTP webhook
       

  Your App   
  /api/inngest

       
        3. Execute Function
           (background job)
       

  Function   
  Executes   

`

### Components

1. **Inngest Client**: Singleton for sending events and creating functions
2. **Functions**: Background jobs triggered by events
3. **Serve Endpoint**: API route (/api/inngest) that exposes functions
4. **Events**: Messages that trigger functions
5. **Steps**: Durable units of work within functions

---

## Setup Guide

### 1. Install Inngest

`ash
npm install inngest
`

### 2. Run Inngest Dev Server (Local Development)

`ash
npx --ignore-scripts=false inngest-cli@latest dev
`

This starts a local development server at http://localhost:8288 with:
- In-memory event storage
- Function execution
- Development UI for testing

### 3. Create Inngest Client

Create lib/inngest.ts:

`	ypescript
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "your-app-id",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
`

**Configuration Options:**
- id: Unique identifier for your app
- eventKey: For sending events (from environment variable)
- signingKey: For securing serve endpoint (from environment variable)

---

## Creating Functions

### Function Structure

Inngest functions are created using createFunction():

`	ypescript
export const myFunction = inngest.createFunction(
  // 1. Configuration
  { 
    id: "function-id",
    retries: 3,
    concurrency: 10,
  },
  // 2. Trigger
  { 
    event: "app/event.name",
  },
  // 3. Handler
  async ({ event, step }) => {
    // Your function logic here
  }
);
`

### Parameters Explained

**Configuration Object:**
- id: Unique function identifier (required)
- etries: Number of retry attempts (default: 3)
- concurrency: Max parallel executions
- ateLimit: Rate limiting configuration
- atchEvents: Process multiple events together

**Trigger Object:**
- event: Event name that triggers this function
- cron: Cron schedule for timed execution

**Handler Function:**
- event.data: Event payload data
- step: API for durable steps
- logger: Logging helpers

### Example: Hello World Function

`	ypescript
import { inngest } from "@/lib/inngest";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    // Durable sleep - survives server restarts
    await step.sleep("wait-a-moment", "1s");
    
    // Return result
    return { 
      message: Hello ! 
    };
  }
);
`

---

## Using Steps

Steps are durable units of work within functions. They:
- Survive server failures
- Can be retried individually
- Provide execution timeline

### Step Types

**1. step.run() - Execute code**

`	ypescript
await step.run("process-data", async () => {
  const result = await someAsyncOperation();
  return result;
});
`

**2. step.sleep() - Durable delay**

`	ypescript
await step.sleep("wait-period", "5s");
`

**3. step.waitForEvent() - Wait for another event**

`	ypescript
const { data } = await step.waitForEvent("await-response", {
  event: "app/response.received",
  timeout: "1h",
});
`

### Step Benefits

| Feature | Without Steps | With Steps |
|---------|---------------|------------|
| **Server restart** | Lost | Resumed |
| **Retry** | All or nothing | Per-step |
| **Observability** | Limited | Full timeline |
| **Debugging** | Difficult | Easy |

---

## Serving Functions

### Create Serve Endpoint

Create pp/api/inngest/route.ts:

`	ypescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { helloWorld } from "@/features/example/inngest/functions";

export const { GET, POST } = serve({
  client: inngest,
  functions: [
    helloWorld,
    // Add all your functions here
  ],
});
`

### How Serve Works

1. Inngest calls your serve endpoint via HTTP
2. Serve endpoint invokes the appropriate function
3. Function executes and returns result
4. Inngest stores execution logs

### Framework Adapters

Inngest provides adapters for different frameworks:

`	ypescript
// Next.js
import { serve } from "inngest/next";

// Astro
import { serve } from "inngest/astro";

// Remix
import { serve } from "inngest/remix";
`

---

## Sending Events

### Basic Event Send

`	ypescript
await inngest.send({
  name: "app/user.signup",
  data: {
    email: "user@example.com",
    userId: "123",
  },
});
`

### Event Structure

`	ypescript
{
  name: string,        // Event name (triggers functions)
  data: object,        // Event payload
  id?: string,         // Optional custom ID
  ts?: number,         // Optional timestamp
}
`

### Sending from API Route

`	ypescript
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  
  await inngest.send({
    name: "app/user.created",
    data: body,
  });
  
  return NextResponse.json({ message: "Event sent!" });
}
`

### Sending Multiple Events

`	ypescript
await inngest.send([
  { name: "app/event1", data: {...} },
  { name: "app/event2", data: {...} },
  { name: "app/event3", data: {...} },
]);
`

---

## Event-Driven Architecture

### Fan-Out Pattern

One event can trigger multiple functions:

`	ypescript
// Send one event
await inngest.send({
  name: "app/user.signup",
  data: { email: "user@example.com" },
});

// Multiple functions respond
const sendWelcomeEmail = inngest.createFunction(
  { id: "send-welcome" },
  { event: "app/user.signup" },
  async ({ event }) => { /* ... */ }
);

const createProfile = inngest.createFunction(
  { id: "create-profile" },
  { event: "app/user.signup" },
  async ({ event }) => { /* ... */ }
);

const trackAnalytics = inngest.createFunction(
  { id: "track-analytics" },
  { event: "app/user.signup" },
  async ({ event }) => { /* ... */ }
);
`

### Event History

Inngest stores all events, enabling:
- **Replay**: Re-run functions with past events
- **Debugging**: Inspect what triggered functions
- **Audit Trail**: Complete event history

---

## Error Handling & Retries

### Automatic Retries

Functions automatically retry on failure:

`	ypescript
export const myFunction = inngest.createFunction(
  { 
    id: "my-function",
    retries: 3,  // Retry 3 times
  },
  { event: "app/event" },
  async ({ event, step }) => {
    await step.run("risky-operation", async () => {
      // If this fails, Inngest retries
      await someRiskyOperation();
    });
  }
);
`

### Retry Behavior

| Attempt | Delay |
|---------|-------|
| 1 (initial) | 0s |
| 2 | 1s |
| 3 | 2s |
| 4 | 4s |
| 5 | 8s |

### Custom Error Handling

`	ypescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "app/event" },
  async ({ event, step }) => {
    try {
      await step.run("process", async () => {
        // Your logic
      });
    } catch (error) {
      // Log error, Inngest will retry
      throw error;  // Throw to trigger retry
    }
  }
);
`

---

## Concurrency & Rate Limiting

### Concurrency Control

Limit parallel executions:

`	ypescript
export const myFunction = inngest.createFunction(
  { 
    id: "my-function",
    concurrency: {
      limit: 10,  // Max 10 parallel executions
      key: "event.data.userId",  // Per-user limit
    },
  },
  { event: "app/event" },
  async ({ event, step }) => {
    // ...
  }
);
`

### Rate Limiting

Limit execution frequency:

`	ypescript
export const myFunction = inngest.createFunction(
  { 
    id: "my-function",
    rateLimit: {
      key: "event.data.userId",
      limit: 5,
      period: "1m",  // 5 executions per minute
    },
  },
  { event: "app/event" },
  async ({ event, step }) => {
    // ...
  }
);
`

---

## Scheduled Functions (Cron)

### Cron Triggers

Run functions on a schedule:

`	ypescript
export const dailyReport = inngest.createFunction(
  { id: "daily-report" },
  { 
    cron: "0 9 * * *",  // 9 AM daily
  },
  async ({ step }) => {
    await step.run("generate-report", async () => {
      // Generate daily report
    });
  }
);
`

### Cron Expressions

`
* * * * *
    
     Day of week (0-6, 0 = Sunday)
    Month (1-12)
   Day of month (1-31)
  Hour (0-23)
 Minute (0-59)
`

**Examples:**
-   9 * * * - 9 AM daily
-   */6 * * * - Every 6 hours
-   0 * * 0 - Sunday midnight
- */30 * * * * - Every 30 minutes

---

## Testing

### Local Development

1. Start Inngest Dev Server:
   `ash
   npx --ignore-scripts=false inngest-cli@latest dev
   `

2. Open Dev UI: http://localhost:8288

3. Trigger function from UI:
   - Go to Functions tab
   - Click "Invoke" on your function
   - Add event payload
   - Click "Invoke Function"

4. View execution in Runs tab

### Testing from Code

`	ypescript
// Test API route
await fetch("http://localhost:3000/api/hello");

// Check Inngest Dev UI for execution
`

---

## Production Deployment

### Environment Variables

Add to your .env:

`ash
INNGEST_EVENT_KEY=evt_xxxxxxxxxxxxx
INNGEST_SIGNING_KEY=sign_xxxxxxxxxxxxx
`

### Deploy to Vercel

1. Push code to your repository
2. Deploy to Vercel
3. Inngest auto-discovers your functions
4. Functions available in production dashboard

### Production vs Development

| Feature | Development | Production |
|---------|-------------|------------|
| **Server** | Local dev server | Inngest Cloud |
| **Storage** | In-memory | Persistent |
| **URL** | localhost:8288 | app.inngest.com |
| **UI** | Local dashboard | Production dashboard |

---

## Best Practices

### 1. Use Steps for Long Operations

`	ypescript
// Good
await step.run("process", async () => {
  await longOperation();
});

// Avoid (not durable)
await longOperation();
`

### 2. Idempotent Functions

`	ypescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "app/event" },
  async ({ event, step }) => {
    const existing = await checkIfExists(event.data.id);
    if (existing) {
      return { message: "Already processed" };
    }
    
    await step.run("create", async () => {
      await createRecord(event.data);
    });
  }
);
`

### 3. Error Boundaries

`	ypescript
await step.run("operation", async () => {
  try {
    await riskyOperation();
  } catch (error) {
    // Log and handle
    logger.error("Operation failed", error);
    throw error;  // Trigger retry
  }
});
`

### 4. Logging

`	ypescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "app/event" },
  async ({ event, step, logger }) => {
    logger.info("Processing event", { eventId: event.id });
    
    await step.run("process", async () => {
      logger.info("Starting process");
      // ...
    });
  }
);
`

---

## Common Patterns

### Webhook Processing

`	ypescript
// Webhook endpoint
export async function POST(request: Request) {
  const payload = await request.json();
  
  // Log to DB first
  const logId = await logToDB(payload);
  
  // Send to Inngest for processing
  await inngest.send({
    name: "webhook/received",
    data: { logId },
  });
  
  return Response.json({ success: true });
}

// Inngest function
export const processWebhook = inngest.createFunction(
  { id: "process-webhook" },
  { event: "webhook/received" },
  async ({ event, step }) => {
    const { logId } = event.data;
    
    await step.run("process", async () => {
      const payload = await getFromDB(logId);
      await processPayload(payload);
    });
  }
);
`

### Email Sending

`	ypescript
export const sendWelcomeEmail = inngest.createFunction(
  { id: "send-welcome-email" },
  { event: "app/user.signup" },
  async ({ event, step }) => {
    await step.run("send-email", async () => {
      await sendEmail({
        to: event.data.email,
        template: "welcome",
      });
    });
  }
);
`

### Data Processing Pipeline

`	ypescript
export const processDataPipeline = inngest.createFunction(
  { id: "data-pipeline" },
  { event: "app/data.uploaded" },
  async ({ event, step }) => {
    // Step 1: Validate
    const validated = await step.run("validate", async () => {
      return await validateData(event.data);
    });
    
    // Step 2: Transform
    const transformed = await step.run("transform", async () => {
      return await transformData(validated);
    });
    
    // Step 3: Store
    await step.run("store", async () => {
      await storeData(transformed);
    });
    
    // Step 4: Notify
    await step.run("notify", async () => {
      await sendNotification(event.data.userId);
    });
  }
);
`

---

## Troubleshooting

### Function Not Triggered

1. Check event name matches function trigger
2. Verify serve endpoint is accessible
3. Check Inngest dashboard for errors
4. Ensure environment variables are set

### Function Not Retrying

1. Check if error is thrown (not caught)
2. Verify retry configuration
3. Check if max retries reached
4. Review function logs

### Slow Execution

1. Check if steps are properly used
2. Review database queries
3. Check external API calls
4. Consider increasing concurrency

---

## Resources

- [Inngest Documentation](https://www.inngest.com/docs)
- [Function Reference](https://www.inngest.com/docs/reference/functions/create)
- [Step Reference](https://www.inngest.com/docs/steps)
- [Examples](https://www.inngest.com/docs/examples)
- [Deploy Guide](https://www.inngest.com/docs/deploy)

---

## Summary

Inngest provides:
-  Durable background jobs
-  Automatic retries
-  Event-driven architecture
-  Bypass Vercel time limits
-  Full observability
-  Zero infrastructure

Perfect for:
- Webhook processing
- Email sending
- Data pipelines
- Scheduled tasks
- Long-running operations
