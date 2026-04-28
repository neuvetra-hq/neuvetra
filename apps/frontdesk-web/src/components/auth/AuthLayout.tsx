import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface AuthLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <a href="/" className="mb-8 flex items-center justify-center gap-2">
          <img src="/logo-v2.png" alt="Front Desk" className="h-9 w-9 object-contain" />
          <span className="text-lg font-semibold text-foreground">Front Desk</span>
        </a>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-4 text-center">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
