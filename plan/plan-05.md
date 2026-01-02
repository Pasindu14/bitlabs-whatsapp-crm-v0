1) App opens (initial load)

Show App Shell (sidebar + chat area skeleton).

Fetch current user/session.

Fetch conversation list (recent chats).

Render conversation rows (name, last message preview, time, unread count).

If there was a last selected conversation:

Auto-select it

Fetch its messages

Scroll to latest message

If no conversation selected:

Show empty state: “Select a chat / Start new chat”.



2) Sidebar: Search chats

User types in Search.

Debounce input (e.g., 300ms).

Filter:

Local filter search by contacts number and name only


Render results.

Clearing search restores full list.

3) Sidebar: Filter chips (All / Unread / Favorites / Groups)

User clicks a filter.

Update filter state.

Reload list (or filter locally).

Keep current selection if it still exists in filtered list.

If selected convo not in filter, either:

Auto-select first result, OR

Show “No chat selected” state.

4) Archived section

User clicks Archived.

UI switches list to archived conversations.

Selecting an archived conversation:

Loads messages same as normal

Unarchive action (if available):

Removes from archived list

Returns to normal list (or updates instantly)


5) Selecting a conversation (from left list)

User clicks a conversation row.

Mark it as selected (highlight).

Chat header updates (name, avatar, presence).

Load messages:

Show message skeleton

Fetch messages for that conversation

On success:

Render message history

Scroll to bottom (latest)

Mark as read:

Unread badge clears

Server updates “lastReadAt / unreadCount=0”

6.2Menu (3 dots)

Typical actions:

View contact/group info

Clear chat

also add assign to user

Delete chat

Each action:

Opens confirm modal → on confirm → server call → update UI.


7) Message list behaviors (center area)
7.1 Scrolling up (load older messages)

User scrolls near top.

Show “loading older…” indicator.

Fetch previous page using cursor/messageId.

Prepend messages.

Maintain scroll position (no jump).

7.2 Date separators

When messages cross different dates → insert “Today / Yesterday / date”.

7.3 Message status rendering

For each outbound message:

Sending (spinner)

Sent

Delivered

Read
Statuses update via webhook/polling.