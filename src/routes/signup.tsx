import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create your account — Stockroom" },
      { name: "description", content: "Create a free Stockroom account and workspace." },
      { property: "og:title", content: "Create your account — Stockroom" },
      { property: "og:description", content: "Create a free Stockroom account and workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="signup" redirect={Route.useSearch().redirect} />,
});
