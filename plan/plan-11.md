---
feature: Audio Recording and Sending in Chat
date: 2026-01-09
planNumber: 11
---

# Feature Master Plan: Audio Recording and Sending in Chat

## 1) Feature Summary

**Goal**: Enable users to record audio messages directly in the chat interface and send them via WhatsApp. Users can record, preview, and send voice notes through the existing attachment menu.

**Actors & Permissions**:
- All authenticated users can record and send audio messages
- No special permissions required beyond standard authentication

**Primary Flows**:
1. **Record Audio**: User clicks "Audio" in attachment menu → microphone permission requested → recording starts → user stops recording → audio preview shown
2. **Preview Audio**: User plays back recorded audio before sending → can re-record or delete
3. **Send Audio**: User clicks send → audio uploaded → message created and sent via WhatsApp API
4. **Cancel Recording**: User can cancel recording before sending
5. **View Received Audio**: Audio messages display in chat with playback controls

**Assumptions**:
- Browser MediaRecorder API is available (modern browsers)
- Microphone permission is granted by user
- Audio files are stored using existing UploadThing infrastructure
- WhatsApp API supports audio messages
- Maximum recording duration: 5 minutes (WhatsApp limit)
- Supported audio format: MP3 or M4A (WhatsApp preferred)

---

## 2) Domain Model

**Entities**:
- **Message**: Already exists with media support (mediaUrl, mediaType, mediaMimeType)
- **AudioRecording**: Transient client-side entity (not persisted to DB)
  - Properties: blob, duration, mimeType, createdAt

**Relationships**:
- Message 1 → 1 MediaUrl (audio file stored in cloud storage)

**State Machine**:
```
[idle] → [requesting_permission] → [recording] → [recorded] → [sending] → [sent]
         ↓                        ↓
      [denied]                [cancelled]
```

---

## 3) Database Design (Postgres/Drizzle)

**No new tables required** - using existing `messages` table schema:

**Existing Table: `messages`** (already supports audio)
- `mediaUrl`: text (URL to audio file)
- `mediaType`: text (enum: 'audio')
- `mediaMimeType`: text (e.g., 'audio/mpeg', 'audio/mp4')
- `mediaId`: text (UploadThing file key)
- `mediaCaption`: text (optional caption for audio)

**Expected Queries**:
- Insert message with audio mediaUrl
- Fetch messages with audio mediaType
- No schema changes needed

**Migration Steps**:
- None (schema already supports audio)

---

## 4) API / Server Actions Contract

**Actions to Modify**:
- `uploadImageAction` → Rename/extend to `uploadMediaAction` to support audio files
- `sendNewMessageAction` → Already supports mediaType, no changes needed

**New Actions**:
- None required (reusing existing infrastructure)

**Inputs/Outputs**:

**`uploadMediaAction`** (modified):
- **Input**: `{ fileKey: string, fileUrl: string, fileName: string, fileSize: number, fileType: string, conversationId: number }`
- **Output**: `FileUploadResponse`
- **Error cases**: Invalid file type, file too large, upload failed
- **Supported types**: Add 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg'

**`sendNewMessageAction`** (no changes):
- Already accepts `mediaType: 'audio'`
- Already handles mediaUrl and mediaMimeType

**Pagination Strategy**:
- No changes (existing cursor pagination for messages)

---

## 5) Validation (Zod)

**Schemas to Modify**:

**`fileUploadClientSchema`** (extend to support audio):
```typescript
export const FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',      // MP3
  'audio/mp4',       // M4A
  'audio/webm',      // WebM audio
  'audio/ogg',       // OGG
] as const;

export const fileUploadClientSchema = z.object({
  file: z.instanceof(File)
    .refine((f) => f.size <= 16 * 1024 * 1024, 'Audio file size must be less than 16MB')
    .refine((f) => FILE_TYPES.includes(f.type as FileType), 'Invalid file type. Supported: Images (JPEG, PNG, WEBP), Audio (MP3, M4A, WebM, OGG)'),
});
```

**New Schema**:
```typescript
// Audio recording metadata
export const audioRecordingMetadataSchema = z.object({
  duration: z.number().int().positive().max(300, 'Recording too long (max 5 minutes)'),
  mimeType: z.enum(['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg']),
  size: z.number().int().positive().max(16 * 1024 * 1024, 'File too large (max 16MB)'),
});

export type AudioRecordingMetadata = z.infer<typeof audioRecordingMetadataSchema>;
```

**Shared Types**:
- `AudioRecordingState`: `{ isRecording: boolean, duration: number, blob: Blob | null, mimeType: string | null }`

---

## 6) Service Layer Plan

**Service Methods** (modifications to existing UploadThingService):

**`UploadThingService.saveFileUpload`** (extend to support audio):
- **Responsibility**: Save file metadata to DB (already exists)
- **Modification**: Accept audio MIME types in addition to images
- **Transaction**: Single transaction (already implemented)
- **Safety Rules**: 
  - Validate file type (image or audio)
  - Validate file size (16MB max for audio)
  - Validate conversation exists
- **Performance Logging**: `UploadThingService.saveFileUpload`
- **Result Mapping**: 
  - Success: `Result.ok(fileUploadResponse)`
  - Failure: `Result.fail()` for validation errors

**Transaction Boundaries**:
- No changes (existing single transaction)

---

## 7) UI/UX Plan (shadcn + TanStack)

**Screens/Components to Add**:

1. **`AudioRecorder`** (new component):
   - Location: `features/conversations/components/audio-recorder.tsx`
   - UI: Recording interface with:
     - Microphone icon with pulsing animation when recording
     - Timer display (MM:SS format)
     - Stop recording button (square icon)
     - Cancel button (X icon)
   - States: Idle, Requesting Permission, Recording, Recorded, Error
   - Features:
     - Request microphone permission on mount
     - Real-time timer update
     - Visual feedback during recording
     - Handle permission denied
     - Auto-stop at 5 minutes

2. **`AudioPreview`** (new component):
   - Location: `features/conversations/components/audio-preview.tsx`
   - UI: Audio player with:
     - Audio waveform visualization (optional, simple progress bar)
     - Play/Pause button
     - Duration display
     - Delete button (X icon)
     - Re-record button (microphone icon)
   - States: Playing, Paused, Loading
   - Features:
     - HTML5 audio element
     - Custom controls styling
     - Duration formatting

3. **Modify `MessageInput`** component:
   - Add "Audio" menu item to attachment dropdown (next to "Photos & videos")
   - Add audio preview section (below image preview)
   - Handle audio recording state
   - Send audio with message

4. **Modify `MessageList`** component:
   - Already renders audio with `<audio>` tag
   - Ensure proper styling for audio messages

**Forms**:
- No forms needed (recording only)

**Empty/Loading/Error States**:
- **Requesting permission**: "Requesting microphone access..."
- **Permission denied**: "Microphone access denied. Please allow microphone access to record audio."
- **Recording error**: "Failed to record audio. Please try again."
- **No audio**: (initial state, no UI shown)

**Toast Strategy**:
- Success: "Audio message sent"
- Error: "Failed to send audio. Please try again."
- Permission denied: "Microphone access denied"
- Recording too long: "Recording stopped (max 5 minutes)"

**Visual Journey**:

**Flow: Record and Send Audio**

1. **Initial State**:
   - User is in conversation detail view
   - Message input visible at bottom with attachment button (plus icon)
   - No audio recording in progress

2. **User Action**:
   - User clicks attachment button (plus icon)
   - Dropdown menu appears with options: "Photos & videos", "Audio"

3. **UI Transition**:
   - User clicks "Audio" menu item
   - Browser prompts for microphone permission
   - Permission dialog: "Allow this site to use your microphone?"
   - User clicks "Allow"

4. **Recording State**:
   - Audio recorder interface appears in message input area
   - Microphone icon pulsing with red animation
   - Timer starts: "00:00", increments every second
   - Stop button (square icon) visible
   - Cancel button (X icon) visible
   - Message input area shows: "Recording audio..."

5. **User Records**:
   - User speaks into microphone
   - Timer updates: "00:15", "00:30", "00:45"
   - Pulsing animation continues
   - User clicks stop button at "01:23"

6. **Preview State**:
   - Recording stops
   - Audio preview appears with:
     - Play button (triangle icon)
     - Progress bar showing duration
     - Duration display: "1:23"
     - Delete button (X icon)
     - Re-record button (microphone icon)
   - User clicks play button to preview
   - Audio plays through speakers
   - User clicks pause to stop preview

7. **Sending**:
   - User clicks send button (paper plane icon)
   - Send button shows spinner
   - Audio uploads to cloud
   - Message created with mediaType: 'audio'
   - Send button returns to normal
   - Audio preview disappears
   - Message appears in chat list with audio player

8. **Success State**:
   - Audio message visible in chat
   - Audio player with play/pause controls
   - Duration: "1:23"
   - Toast appears: "Audio message sent" (green, checkmark, 3s)
   - Conversation moves to top of list

**Error Scenarios**:

**Microphone Permission Denied**:
- When: User clicks "Deny" in permission dialog
- Visual: Red error message in recording area
- Message: "Microphone access denied. Please allow microphone access in your browser settings."
- Behavior: Recording cancelled, user returned to normal input

**Recording Too Long**:
- When: Recording reaches 5 minutes
- Visual: Timer stops at "05:00"
- Message: Toast "Recording stopped (max 5 minutes)"
- Behavior: Recording auto-stops, preview shown with 5-minute audio

**Upload Failed**:
- When: Audio upload to cloud fails
- Visual: Send button re-enables
- Message: Toast "Failed to send audio. Please try again." (red, X icon, 5s)
- Behavior: Audio preview remains, user can retry

**Browser Not Supported**:
- When: Browser doesn't support MediaRecorder API
- Visual: Error message in attachment menu
- Message: "Audio recording not supported in this browser"
- Behavior: "Audio" menu item disabled or hidden

---

## 8) Hook/State Plan

**Hooks to Create**:

1. **`useAudioRecorder`** (new hook):
   - Location: `features/conversations/hooks/use-audio-recorder.ts`
   - **Responsibility**: Manage audio recording state and MediaRecorder API
   - **Returns**:
     ```typescript
     {
       isRecording: boolean,
       duration: number,
       blob: Blob | null,
       mimeType: string | null,
       error: string | null,
       startRecording: () => Promise<void>,
       stopRecording: () => void,
       cancelRecording: () => void,
       resetRecording: () => void,
     }
     ```
   - **Features**:
     - Request microphone permission
     - Initialize MediaRecorder with supported MIME type
     - Handle data chunks and create Blob
     - Calculate duration
     - Auto-stop at 5 minutes
     - Cleanup on unmount

2. **Modify `useSendNewMessage`** hook:
   - Already supports mediaType, no changes needed
   - Will handle audio messages with mediaType: 'audio'

**Local State (Zustand)**:

**Modify `ConversationStore`**:
```typescript
interface ConversationStore {
  // Existing state...
  selectedImage: { file: File; previewUrl: string } | null;
  clearSelectedImage: () => void;

  // New state for audio
  audioRecording: {
    blob: Blob;
    duration: number;
    mimeType: string;
  } | null;
  setAudioRecording: (recording: { blob: Blob; duration: number; mimeType: string } | null) => void;
  clearAudioRecording: () => void;
}
```

**Optimistic Updates**:
- Not needed for audio (upload required before sending)

---

## 9) Security & Compliance

**Auth Requirements**:
- Session-based authentication (already implemented)
- All operations scoped by `companyId` from session

**Row-level Tenant Enforcement**:
- Service layer validates conversation belongs to user's company
- Database queries include `companyId` filter
- Prevents cross-tenant data leakage

**Data Validation**:
- File type validation (audio MIME types only)
- File size validation (16MB max)
- Duration validation (5 minutes max)
- Malicious file prevention (MIME type spoofing)

**Privacy**:
- Microphone permission explicitly requested from user
- Audio files stored securely in cloud storage (UploadThing)
- No audio data stored in browser after sending
- Audio accessible only to conversation participants

---

## 10) Testing Plan

**Unit Tests**:

**`useAudioRecorder` hook**:
- Request microphone permission success
- Request microphone permission denied
- Start recording successfully
- Stop recording and create Blob
- Cancel recording
- Auto-stop at 5 minutes
- Handle unsupported browser
- Cleanup on unmount

**Service method `UploadThingService.saveFileUpload`**:
- Valid audio file upload
- Invalid file type rejection
- File too large rejection
- Invalid conversation ID

**Integration Tests**:

**Audio recording flow**:
- Record → preview → send → verify in DB
- Record → cancel → verify not in DB
- Record → re-record → verify only latest sent
- Permission denied → error handling

**Audio message display**:
- Audio message appears in chat
- Audio player controls work
- Duration displayed correctly
- Audio plays correctly

**UI Tests**:

**`AudioRecorder` component**:
- Renders recording state
- Timer updates correctly
- Stop button works
- Cancel button works
- Permission denied state shows

**`AudioPreview` component**:
- Renders with audio blob
- Play/pause button works
- Duration displays correctly
- Delete button works
- Re-record button works

**Critical Flows**:

1. **Full recording flow**: Open menu → click Audio → allow permission → record → stop → preview → send → verify in chat
2. **Cancel recording**: Open menu → click Audio → record → cancel → verify not sent
3. **Re-record**: Record → preview → re-record → record again → send → verify latest sent
4. **Permission denied**: Open menu → click Audio → deny permission → error message
5. **Max duration**: Record for 5 minutes → auto-stop → preview shows 5:00

**Edge Cases**:

- Microphone not available (no hardware)
- Browser doesn't support MediaRecorder API
- Network error during upload
- Very long recording (5 minutes)
- Very short recording (< 1 second)
- Multiple rapid recordings
- Recording while another message is sending
- Audio file corrupted during upload

---

## 11) Performance & Observability

**Query Cost Risks**:
- Audio upload: 16MB max file size, acceptable
- No DB query changes
- No N+1 queries expected

**Required Indexes**:
- No new indexes (existing message indexes sufficient)

**Logging/Metrics Events**:
- `audio_recording.started` - Recording started (conversationId, userId)
- `audio_recording.completed` - Recording completed (conversationId, userId, duration)
- `audio_recording.cancelled` - Recording cancelled (conversationId, userId)
- `audio_message.sent` - Audio message sent (conversationId, userId, fileSize, duration)
- `audio_upload.failed` - Upload failed (conversationId, userId, error)
- `audio_recording.permission_denied` - Permission denied (conversationId, userId)

**N+1 Avoidance**:
- Single query for message insertion
- No nested queries

**Debouncing**:
- Timer updates: Every second (no debouncing needed)
- Audio upload: No debouncing (single upload)

**Performance Optimization**:
- Use MediaRecorder with efficient codec (opus/webm preferred)
- Compress audio before upload if needed
- Lazy load audio player in message list
- Use streaming upload for large files

---

## 12) Delivery Checklist

**Files to Create**:

1. `features/conversations/components/audio-recorder.tsx` - Recording UI component
2. `features/conversations/components/audio-preview.tsx` - Preview UI component
3. `features/conversations/hooks/use-audio-recorder.ts` - Recording hook

**Files to Modify**:

1. `features/conversations/schemas/conversation-schema.ts` - Add audio MIME types to FILE_TYPES
2. `features/conversations/actions/message-actions.ts` - Rename/extend uploadImageAction to uploadMediaAction
3. `features/conversations/store/conversation-store.ts` - Add audio recording state
4. `features/conversations/components/message-input.tsx` - Add audio menu item and preview
5. `app/api/uploadthing/core.ts` - Add audio file types to file router

**Order of Implementation**:

1. **Schema Layer** (Day 1)
   - Add audio MIME types to FILE_TYPES constant
   - Update fileUploadClientSchema to accept audio
   - Add audioRecordingMetadataSchema

2. **Hook Layer** (Day 1-2)
   - Create `useAudioRecorder` hook
   - Test recording functionality locally
   - Handle permission states

3. **Component Layer** (Day 2-3)
   - Create `AudioRecorder` component
   - Create `AudioPreview` component
   - Test recording UI
   - Test preview UI

4. **Service Layer** (Day 3)
   - Modify `uploadImageAction` to `uploadMediaAction`
   - Add audio MIME type support
   - Test audio upload

5. **Store Layer** (Day 3)
   - Add audio recording state to ConversationStore
   - Add set/clear methods

6. **Integration** (Day 3-4)
   - Integrate audio recorder into MessageInput
   - Add "Audio" menu item to attachment dropdown
   - Connect recording to send flow
   - Test full recording and send flow

7. **Testing** (Day 4-5)
   - Unit tests for hook
   - Integration tests for recording flow
   - UI tests for components
   - Manual testing on different browsers
   - Test permission flows

8. **Polish** (Day 5)
   - Add loading states
   - Add error handling
   - Add toasts
   - Optimize audio quality
   - Performance testing
   - Accessibility testing

**Definition of Done**:

- [ ] Audio MIME types added to schema
- [ ] `useAudioRecorder` hook implemented and tested
- [ ] `AudioRecorder` component built and working
- [ ] `AudioPreview` component built and working
- [ ] "Audio" menu item added to attachment dropdown
- [ ] Audio recording flow working end-to-end
- [ ] Audio preview before sending working
- [ ] Audio upload to cloud working
- [ ] Audio message sent via WhatsApp API
- [ ] Audio messages display correctly in chat
- [ ] Audio player controls working
- [ ] Permission handling working
- [ ] Error handling for all edge cases
- [ ] Loading states displayed
- [ ] Toast notifications working
- [ ] Multi-tenant isolation verified
- [ ] File size validation working (16MB max)
- [ ] Duration validation working (5 minutes max)
- [ ] All tests passing
- [ ] Manual testing completed
- [ ] Performance acceptable
- [ ] Code linted and formatted
- [ ] Documentation updated

---

## Appendix: Technical Details

### MediaRecorder API

**Browser Support**:
- Chrome: Yes (since v49)
- Firefox: Yes (since v25)
- Safari: Yes (since v14.1)
- Edge: Yes (since v79)

**Supported MIME Types**:
```typescript
const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',  // Preferred (Chrome, Firefox)
  'audio/mp4',               // Safari
  'audio/ogg;codecs=opus',   // Firefox
  'audio/mpeg',              // Fallback
];
```

**Recording Implementation**:
```typescript
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: getSupportedMimeType(),
  audioBitsPerSecond: 128000, // 128 kbps
});

const chunks: BlobPart[] = [];
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) chunks.push(e.data);
};

mediaRecorder.onstop = () => {
  const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
  // Handle blob
};
```

### Audio File Size Estimation

**Bitrate**: 128 kbps (good quality for voice)
**Duration**: 5 minutes (300 seconds)
**Estimated size**: 128 kbps × 300s = 38,400 kb ≈ 4.7 MB
**Max limit**: 16 MB (allows for overhead and higher bitrates)

### WhatsApp Audio Message Requirements

**Supported Formats**:
- MP3 (audio/mpeg)
- M4A (audio/mp4)
- OGG (audio/ogg)
- WebM (audio/webm)

**Size Limit**: 16 MB
**Duration Limit**: 5 minutes (300 seconds)

**API Payload**:
```json
{
  "type": "audio",
  "audio": {
    "id": "<MEDIA_ID>",
    "link": "<MEDIA_URL>"
  }
}
```

### Recommended NPM Packages

**No additional packages needed** - using browser native APIs:
- MediaRecorder API (native)
- UploadThing (already installed)
- shadcn/ui (already installed)

### Alternative Considered

**react-media-recorder**:
- Pros: Easier API, cross-browser compatibility
- Cons: Additional dependency, less control
- Decision: Use native MediaRecorder API for better control and performance

### Total Additional Dependencies: 0 packages

---

- Conversation detail page with message list and input area
- Attachment button (plus icon) next to message input opens dropdown menu
- Dropdown menu has items: "Photos & videos", "Audio"
- Clicking "Audio" requests microphone permission
- Recording interface appears with pulsing microphone icon and timer (MM:SS)
- Stop button (square) and cancel button (X) visible during recording
- Timer auto-stops at 5 minutes with toast notification
- After stopping, audio preview appears with play/pause, duration, delete, and re-record buttons
- Send button uploads audio and creates message with mediaType: 'audio'
- Audio messages display in chat with HTML5 audio player and controls
- Database: messages table with mediaUrl, mediaType, mediaMimeType, mediaId fields (already exists)
- Schema: FILE_TYPES extended with audio/mpeg, audio/mp4, audio/webm, audio/ogg
- Service: UploadThingService.saveFileUpload extended to support audio files
- Actions: uploadMediaAction (renamed from uploadImageAction), sendNewMessageAction (no changes)
- Hooks: useAudioRecorder (new), useSendNewMessage (no changes needed)
- Zustand store: ConversationStore with audioRecording state
