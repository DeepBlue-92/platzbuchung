# Firestore Security Specification

## Data Invariants
1. A booking can only be created by an authenticated user, and `bookedBy` must strictly equal `request.auth.uid`.
2. A user profile (`users/{userId}`) can only be created/updated by the user themselves (`userId == request.auth.uid`), and `role` must be verified. Users cannot elevate their own role to 'admin'.
3. Admin paths (`state/settings`, `state/championship`, `state/rankings`, `tournaments/{id}`) can only be modified if the user exists in the `admins` collection.
4. All arrays must be size-constrained.

## The "Dirty Dozen" Payloads

1. **Spoofed User ID:** Creating a user profile (`users/spoofedId`) where the ID does not match auth token.
2. **Privilege Escalation:** Creating/Updating a user profile with `role: 'admin'`.
3. **Missing Auth Booking:** Attempting to create a booking while unauthenticated.
4. **Identity spoofed Booking:** Creating a booking with `bookedBy` not matching the author.
5. **Denial of Wallet string:** Setting `reason` on a booking to a 2MB string.
6. **Denial of Wallet array:** Setting `players` to an array with 10,000 elements.
7. **Malicious Setup:** Trying to write to `admins/myUid` directly.
8. **Shadow Field Mutation:** Attempting to inject `isVerified: true` into a Booking payload on update.
9. **Admin State Forgery:** Regular user updating `state/settings` to hijack club branding.
10. **State Tournament Override:** Regular user deleting a tournament.
11. **Booking Takeover:** Regular user trying to update someone else's booking (`bookedBy` != `request.auth.uid`).
12. **Locking Bypass:** Regular user trying to unlock a booking (`isLocked: false`) that was locked by an Admin.
