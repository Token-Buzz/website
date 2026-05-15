import { UserProfile } from '@clerk/nextjs'

export default function AccountPage() {
  return (
    <div className="flex justify-center">
      <UserProfile />
    </div>
  )
}
