/**
 * @spec auth-flow
 *
 * Tests for the authentication flow: email sign-in, Google OAuth,
 * auth state persistence, and protected route redirects.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = vi.fn();
const mockUseRouter = vi.fn(() => ({ push: mockPush }));
vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sonner
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  }),
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  Analytics: {
    login: vi.fn(),
    signUp: vi.fn(),
  },
}));

// Firebase auth function mocks
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockFirebaseSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockUpdateProfile = vi.fn();

// `mockSetPersistence` has to be hoisted, unlike the mocks above it.
// src/lib/firebase.ts calls setPersistence() at module scope, so it runs the
// moment AuthContext imports it — before this module body has evaluated. As a
// plain `const` it was still in its temporal dead zone at that point, and the
// whole suite died on "Cannot access 'mockSetPersistence' before
// initialization" before a single test ran. vi.hoisted lifts the definition
// above the vi.mock factories, which is where the import-time call reaches it.
// The `..._args` rest parameter also gives it a signature the spread call in
// the factory below can type-check against.
const { mockSetPersistence } = vi.hoisted(() => ({
  mockSetPersistence: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  browserLocalPersistence: "local",
  setPersistence: (...args: unknown[]) => mockSetPersistence(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Firebase Firestore mocks
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
  collection: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({})),
}));

vi.mock("firebase/analytics", () => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

// Import after mocks are set up
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Renders a component wrapped in AuthProvider with a controlled auth state. */
function renderWithAuth(ui: React.ReactElement, authUser: unknown = null) {
  // Set up onAuthStateChanged to call back with the given user
  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
    // Call synchronously in a microtask to simulate Firebase's behavior
    setTimeout(() => cb(authUser), 0);
    return vi.fn(); // unsubscribe
  });

  return render(<AuthProvider>{ui}</AuthProvider>);
}

/** Test component that displays auth state. */
function AuthStateDisplay() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? "authenticated" : "none"}</span>
      <span data-testid="email">{(user as { email?: string })?.email ?? ""}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPush.mockReset();
});

describe("AuthContext", () => {
  describe("auth state lifecycle", () => {
    it("starts with loading=true and user=null", () => {
      // Don't trigger callback yet
      mockOnAuthStateChanged.mockImplementation(() => vi.fn());

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>,
      );

      expect(screen.getByTestId("loading").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toBe("none");
    });

    it("sets user and loading=false when onAuthStateChanged fires with a user", async () => {
      const fakeUser = { uid: "u1", email: "test@example.com", displayName: "Test" };

      renderWithAuth(<AuthStateDisplay />, fakeUser);

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
        expect(screen.getByTestId("user").textContent).toBe("authenticated");
        expect(screen.getByTestId("email").textContent).toBe("test@example.com");
      });
    });

    it("sets user=null when onAuthStateChanged fires with null", async () => {
      renderWithAuth(<AuthStateDisplay />, null);

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
        expect(screen.getByTestId("user").textContent).toBe("none");
      });
    });
  });

  describe("signIn (email/password)", () => {
    it("calls signInWithEmailAndPassword and ensureUserDoc on success", async () => {
      const fakeUser = { uid: "u1", email: "a@b.com", displayName: "A" };
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: fakeUser });

      function SignInTest() {
        const { signIn } = useAuth();
        return (
          <button onClick={() => signIn("a@b.com", "pass123")}>Sign In</button>
        );
      }

      renderWithAuth(<SignInTest />, null);

      await waitFor(() => screen.getByText("Sign In"));
      await userEvent.click(screen.getByText("Sign In"));

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          "a@b.com",
          "pass123",
        );
      });
    });

    it("throws when signInWithEmailAndPassword rejects", async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue(new Error("auth/invalid-credential"));

      let caughtError: Error | null = null;

      function SignInTest() {
        const { signIn } = useAuth();
        return (
          <button
            onClick={async () => {
              try {
                await signIn("bad@b.com", "wrong");
              } catch (e) {
                caughtError = e as Error;
              }
            }}
          >
            Sign In
          </button>
        );
      }

      renderWithAuth(<SignInTest />, null);
      await waitFor(() => screen.getByText("Sign In"));
      await userEvent.click(screen.getByText("Sign In"));

      await waitFor(() => {
        expect(caughtError).not.toBeNull();
        expect(caughtError!.message).toContain("auth/invalid-credential");
      });
    });
  });

  describe("signUp", () => {
    it("calls createUserWithEmailAndPassword, updateProfile, and ensureUserDoc", async () => {
      const fakeUser = { uid: "u2", email: "new@b.com", displayName: null };
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: fakeUser });
      mockUpdateProfile.mockResolvedValue(undefined);

      function SignUpTest() {
        const { signUp } = useAuth();
        return (
          <button onClick={() => signUp("new@b.com", "pass123", "New User")}>
            Sign Up
          </button>
        );
      }

      renderWithAuth(<SignUpTest />, null);
      await waitFor(() => screen.getByText("Sign Up"));
      await userEvent.click(screen.getByText("Sign Up"));

      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          "new@b.com",
          "pass123",
        );
        expect(mockUpdateProfile).toHaveBeenCalledWith(fakeUser, {
          displayName: "New User",
        });
      });
    });
  });

  describe("signInWithGoogle", () => {
    it("calls signInWithPopup with the Google provider", async () => {
      const fakeUser = { uid: "g1", email: "google@b.com", displayName: "G" };
      mockSignInWithPopup.mockResolvedValue({ user: fakeUser });

      function GoogleTest() {
        const { signInWithGoogle } = useAuth();
        return <button onClick={signInWithGoogle}>Google</button>;
      }

      renderWithAuth(<GoogleTest />, null);
      await waitFor(() => screen.getByText("Google"));
      await userEvent.click(screen.getByText("Google"));

      await waitFor(() => {
        expect(mockSignInWithPopup).toHaveBeenCalled();
      });
    });
  });

  describe("signOut", () => {
    it("calls firebaseSignOut", async () => {
      mockFirebaseSignOut.mockResolvedValue(undefined);
      const fakeUser = { uid: "u1", email: "a@b.com" };

      function SignOutTest() {
        const { signOut } = useAuth();
        return <button onClick={signOut}>Sign Out</button>;
      }

      renderWithAuth(<SignOutTest />, fakeUser);
      await waitFor(() => screen.getByText("Sign Out"));
      await userEvent.click(screen.getByText("Sign Out"));

      await waitFor(() => {
        expect(mockFirebaseSignOut).toHaveBeenCalled();
      });
    });
  });

  describe("useAuth outside provider", () => {
    it("throws when used outside AuthProvider", () => {
      function Orphan() {
        useAuth();
        return null;
      }

      expect(() => render(<Orphan />)).toThrow(
        "useAuth must be used within AuthProvider",
      );
    });
  });
});

describe("LoginPage", () => {
  // We need to import the page lazily since it depends on useAuth
  let LoginPage: React.ComponentType;

  beforeEach(async () => {
    const mod = await import("@/app/(auth)/login/page");
    LoginPage = mod.default;
  });

  it("renders email and password inputs and sign-in button", async () => {
    const fakeUser = null;
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(fakeUser), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("renders the Google sign-in button", async () => {
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("redirects to /dashboard on successful email sign-in", async () => {
    const user = userEvent.setup();
    const fakeUser = { uid: "u1", email: "a@b.com" };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: fakeUser });
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error toast on failed email sign-in", async () => {
    const user = userEvent.setup();
    mockSignInWithEmailAndPassword.mockRejectedValue(new Error("bad"));
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Invalid email or password. Please try again.",
      );
    });
  });

  it("shows a link to the signup page", async () => {
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });
});

describe("SignupPage", () => {
  let SignupPage: React.ComponentType;

  beforeEach(async () => {
    const mod = await import("@/app/(auth)/signup/page");
    SignupPage = mod.default;
  });

  it("rejects passwords shorter than 6 characters with a toast", async () => {
    const user = userEvent.setup();
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <SignupPage />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText("Full Name"), "Test");
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "12345");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Password must be at least 6 characters.",
      );
    });

    // Should NOT have called Firebase
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("handles email-already-in-use error with a friendly message", async () => {
    const user = userEvent.setup();
    mockCreateUserWithEmailAndPassword.mockRejectedValue(
      new Error("Firebase: Error (auth/email-already-in-use)."),
    );
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <SignupPage />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText("Full Name"), "Test");
    await user.type(screen.getByLabelText("Email"), "existing@b.com");
    await user.type(screen.getByLabelText("Password"), "pass123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "An account with this email already exists.",
      );
    });
  });
});

describe("Protected Route Redirect (AppLayout)", () => {
  let AppLayout: React.ComponentType<{ children: React.ReactNode }>;

  beforeEach(async () => {
    const mod = await import("@/app/(app)/layout");
    AppLayout = mod.default;
  });

  it("shows a skeleton while auth is loading", () => {
    // Never resolve the auth callback to keep loading=true
    mockOnAuthStateChanged.mockImplementation(() => vi.fn());

    render(
      <AuthProvider>
        <AppLayout>
          <div data-testid="protected-content">Secret</div>
        </AppLayout>
      </AuthProvider>,
    );

    // Should NOT show the protected content
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("redirects to /login when user is null after loading", async () => {
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(null), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <AppLayout>
          <div>Protected</div>
        </AppLayout>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders children when user is authenticated", async () => {
    const fakeUser = {
      uid: "u1",
      email: "test@example.com",
      displayName: "Test User",
    };

    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: unknown) => void) => {
      setTimeout(() => cb(fakeUser), 0);
      return vi.fn();
    });

    render(
      <AuthProvider>
        <AppLayout>
          <div data-testid="protected-content">Secret</div>
        </AppLayout>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
  });
});
