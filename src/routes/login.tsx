import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Stockroom" },
      { name: "description", content: "Sign in to your Stockroom workspace." },
      { property: "og:title", content: "Sign in — Stockroom" },
      { property: "og:description", content: "Sign in to your Stockroom workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="login" redirect={Route.useSearch().redirect} />,
});
