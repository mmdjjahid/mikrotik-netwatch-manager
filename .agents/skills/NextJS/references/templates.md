# Code Templates

Copy-ready templates for the `nextjs-fullproof` skill. Adapt names, imports, and auth/data helpers to the real project; never paste blindly.

## Contents
1. Server Action with validation and auth
2. Route Handler
3. Dynamic page (Next 15+)
4. Client form with pending state (Tailwind, theme-aware, mobile-friendly)
5. Responsive, theme-aware card grid (Server Component)
6. Theme provider, toggle, and responsive header (Tailwind + next-themes)

---

**Server Action with validation and auth**
```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth"; // use the project's real auth helper

const Schema = z.object({ title: z.string().trim().min(1).max(120) });

export type ActionState = { ok: boolean; error?: string; fieldErrors?: Record<string, string[]> };

export async function createItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  const parsed = Schema.safeParse({ title: formData.get("title") });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    // await db.item.create({ data: { ...parsed.data, userId: session.user.id } });
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/items");
  return { ok: true };
}
```

**Route Handler**
```ts
import { NextResponse } from "next/server";
import { z } from "zod";

const Query = z.object({ q: z.string().min(1).max(100) });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  // const data = await ...
  return NextResponse.json({ data: [] });
}
```

**Dynamic page (Next 15+)**
```tsx
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // const item = await getItem(id);
  // if (!item) notFound();
  return <main>{id}</main>;
}
```

**Client form with pending state (Tailwind, theme-aware, mobile-friendly)**
```tsx
"use client";

import { useActionState } from "react";
import { createItem, type ActionState } from "@/actions/items";
import { cn } from "@/lib/utils";

const initial: ActionState = { ok: false };

export function ItemForm() {
  const [state, action, pending] = useActionState(createItem, initial);
  const hasTitleError = !!state.fieldErrors?.title;

  return (
    <form action={action} className="mx-auto w-full max-w-md space-y-4 p-4 sm:p-6">
      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-sm font-medium text-foreground">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          aria-invalid={hasTitleError}
          aria-describedby={hasTitleError ? "title-error" : undefined}
          className={cn(
            "block w-full rounded-lg border bg-card px-3 py-2 text-base text-foreground shadow-sm sm:text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            hasTitleError ? "border-red-500" : "border-border"
          )}
        />
        {hasTitleError && (
          <p id="title-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.fieldErrors!.title[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
```

**Responsive, theme-aware card grid (Server Component, Tailwind)**
```tsx
export default async function ItemsPage() {
  // const items = await getItems();
  const items: { id: string; title: string }[] = [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Items</h1>

      {items.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
              {item.title}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

**Theme provider, toggle, and responsive header (Tailwind + next-themes)**
```tsx
// src/components/theme-provider.tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
```
```tsx
// src/app/layout.tsx (Server Component)
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "My App", description: "..." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```
```tsx
// src/components/theme-toggle.tsx
"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* same-size placeholder until mounted prevents hydration mismatch */}
      <span aria-hidden="true" className="text-lg leading-none">{!mounted ? "" : isDark ? "☀" : "☾"}</span>
    </button>
  );
}
```
```tsx
// src/components/site-header.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/items", label: "Items" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]); // close on navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-bold tracking-tight">Brand</Link>

        {/* Desktop / tablet-landscape nav */}
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted-foreground transition hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-border md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border bg-background px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-3 text-base hover:bg-muted">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
```
Notes: install with the project's package manager (`next-themes`). Swap the text glyph icons for the project's icon library if it has one. The `size-11` utility is Tailwind v3.4+/v4; on older v3 use `h-11 w-11`.
