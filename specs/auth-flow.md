---
spec_id: auth-flow
title: Authentication Flow
status: active
last_updated: 2026-03-31
---

# Authentication Flow

## Overview

Override uses Firebase Authentication with two sign-in methods: email/password
and Google OAuth (popup). Auth state is managed by a React context
(`AuthContext`) that wraps the entire app and exposes `user`, `loading`,
`signIn`, `signUp`, `signInWithGoogle`, and `signOut`.

## Functional Requirements

### FR-1: Email/Password Sign-In

- The login page (`/login`) renders email and password inputs and a "Sign In"
  submit button.
- On submit, `signInWithEmailAndPassword` is called via the `signIn` context
  method.
- On success the user is redirected to `/dashboard` and an analytics event
  (`login / email`) is fired.
- On failure a toast error ("Invalid email or password. Please try again.") is
  shown; the user stays on the login page.
- The submit button shows "Signing in..." and is disabled while the request is
  in-flight.

### FR-2: Email/Password Sign-Up

- The signup page (`/signup`) collects Full Name, Email, and Password.
- Password must be at least 6 characters; violations show a toast error before
  any network request.
- On submit, `createUserWithEmailAndPassword` is called, followed by
  `updateProfile` to set the display name and `ensureUserDoc` to upsert a
  Firestore user document.
- On success the user is redirected to `/dashboard` and an analytics event
  (`sign_up / email`) is fired.
- "email-already-in-use" errors surface as "An account with this email already
  exists."

### FR-3: Google OAuth Sign-In

- Both `/login` and `/signup` pages show a "Continue with Google" button.
- Clicking it calls `signInWithPopup` with the `GoogleAuthProvider`.
- On success the user is redirected to `/dashboard`, an analytics event is
  fired, and `ensureUserDoc` upserts the Firestore user document.
- On failure a toast error is shown.

### FR-4: Auth State Persistence

- Firebase auth is configured with `browserLocalPersistence` so sessions survive
  page refreshes and new tabs.
- `onAuthStateChanged` is the single source of truth. The `AuthProvider`
  subscribes on mount and updates `user` / `loading` state accordingly.

### FR-5: Protected Route Redirect

- The app layout (`(app)/layout.tsx`) checks `user` and `loading` from
  `useAuth()`.
- While Firebase is restoring the session (`loading === true`), a centered
  `Skeleton` placeholder is rendered -- never a flash of the login page.
- Once loading completes, if `user` is `null`, `router.push("/login")` fires.
- Authenticated users see the full shell: top nav with Productions / My
  Investments links, user dropdown, and sign-out option.

### FR-6: Sign Out

- Clicking "Sign Out" in the user dropdown calls `firebaseSignOut(auth)`.
- On success the user is redirected to `/` and a success toast is shown.
- On failure an error toast is shown.

## Acceptance Criteria

- [ ] AC-1: Submitting valid credentials on `/login` redirects to `/dashboard`.
- [ ] AC-2: Submitting invalid credentials shows an error toast without navigation.
- [ ] AC-3: Clicking "Continue with Google" triggers the popup OAuth flow.
- [ ] AC-4: The signup form rejects passwords shorter than 6 characters with a toast.
- [ ] AC-5: Unauthenticated users visiting any `(app)` route are redirected to `/login`.
- [ ] AC-6: While auth state is loading, a skeleton is shown instead of content or redirects.
- [ ] AC-7: Signing out redirects to `/` and clears the Firebase session.
- [ ] AC-8: `ensureUserDoc` is called after every successful sign-in/sign-up to keep the Firestore user document current.
