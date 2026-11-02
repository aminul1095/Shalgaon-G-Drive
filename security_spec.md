# Serenity Bay Security Specification & Invariants

## 1. Data Invariants

1. **Authentication Required**: No unauthenticated user may read or write bookings, user profiles, or administrative date blocks.
2. **Owner Isolation on Writes**: A user cannot create a booking where `ownerUid != request.auth.uid`. A user cannot edit or cancel a booking owned by someone else.
3. **Admin Privilege Tiering**: Only an administrator can create, edit, or release `availabilityBlocks`, or alter other users' records.
4. **Immutable Fields**: `bookingId`, `ownerUid`, and `createdAt` cannot be changed after creation.
5. **State Machine / Terminal Locking**: A cancelled booking cannot be reactivated or re-edited.
6. **No Phantom Fields (Strict Schema)**: Payloads containing undefined keys must be rejected by rule gates.
7. **Size Limits & Formatting**: All string fields are constrained in length, dates must follow `YYYY-MM-DD` formatting, and guest counts must be positive integers (`> 0` and `<= 50`).
8. **Date Range Consistency**: `startDate` and `endDate` must be valid, and `occupiedDates` must contain the bounded date list.

## 2. The Dirty Dozen Payloads

1. **Identity Spoofing**: Regular user attempting to set `ownerUid` to an admin UID when creating a booking.
2. **Ghost Field Injection**: Attempting to inject `isAdmin: true` into a booking or user document.
3. **Privilege Escalation**: Non-admin attempting to set their own user role to `"admin"`.
4. **Denial of Wallet (ID Flooding)**: Creating a document with a 1500-character junk document ID.
5. **Mass String Injection**: Submitting a 50KB contact name string to exhaust bandwidth/storage.
6. **Negative Guest Count**: Submitting `numberOfPeople: -5` or `numberOfPeople: 0`.
7. **Tampering with Owner ID on Update**: Booking owner attempting to change `ownerUid` during an update.
8. **Tampering with Creation Timestamp**: Updating `createdAt` during an update action.
9. **Cancelled Resurrection**: Editing a booking whose existing status is `"Cancelled"`.
10. **Unauthorized Cancellation**: User A trying to cancel User B's active booking.
11. **Unauthorized Block Creation**: Non-admin attempting to create an `availabilityBlock`.
12. **Unauthorized Block Modification**: Non-admin attempting to release an `availabilityBlock`.
