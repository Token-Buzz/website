import { redirect } from 'next/navigation'

// Any unmatched route on the marketing site redirects to the home page
// instead of rendering a 404 error (see issue #356).
export default function NotFound() {
  redirect('/')
}
