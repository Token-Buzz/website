import { AppShell } from './_dashboard/Shell'

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
