import type { Metadata } from 'next'
import Nav from '../_components/Nav'
import Footer from '../_components/Footer'
import ContactForm from '../_components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact — TokenBuzz',
  description: 'Get in touch with the TokenBuzz team.',
}

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main style={{ padding: '80px 32px', minHeight: '70vh' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color:         'var(--fg-3)',
                marginBottom:  12,
              }}
            >
              # Contact
            </div>
            <h1
              style={{
                fontFamily:    'var(--font-display)',
                fontSize:      'clamp(36px, 5vw, 56px)',
                lineHeight:    1.1,
                letterSpacing: '0.01em',
                textTransform: 'uppercase',
                color:         'var(--fg-1)',
                margin:        '0 0 16px',
              }}
            >
              Get in touch
            </h1>
            <p
              style={{
                font:   '400 16px/1.6 var(--font-sans)',
                color:  'var(--fg-2)',
                margin: 0,
              }}
            >
              Have a question, feedback, or partnership inquiry? We&apos;d love to hear from you.
            </p>
          </div>
          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
