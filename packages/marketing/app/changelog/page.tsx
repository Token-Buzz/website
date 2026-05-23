import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Nav from '../_components/Nav'
import Footer from '../_components/Footer'

export const metadata: Metadata = {
  title: 'Changelog — TokenBuzz',
  description: 'A history of improvements, fixes, and new features shipped to TokenBuzz.',
}

interface GitHubRelease {
  id: number
  name: string | null
  tag_name: string
  body: string | null
  draft: boolean
  published_at: string | null
}

async function getReleases(): Promise<GitHubRelease[]> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token) {
    console.error('[changelog] No GitHub token found (GITHUB_TOKEN / GH_TOKEN). Returning empty list.')
    return []
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/Token-Buzz/website/releases?per_page=50',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        next: { revalidate: 3600 },
      },
    )

    if (!res.ok) {
      console.error(`[changelog] GitHub API returned ${res.status} ${res.statusText}`)
      return []
    }

    const data: GitHubRelease[] = await res.json()
    return data
      .filter(r => !r.draft)
      .sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0
        return tb - ta
      })
  } catch (err) {
    console.error('[changelog] Fetch error:', err)
    return []
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function ChangelogPage() {
  const releases = await getReleases()

  return (
    <>
      <Nav />
      <main style={{ padding: '80px 32px', minHeight: '70vh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom: 64 }}>
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
              # Changelog
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
              What&apos;s new
            </h1>
            <p
              style={{
                font:   '400 16px/1.6 var(--font-sans)',
                color:  'var(--fg-2)',
                margin: 0,
              }}
            >
              A running record of improvements, fixes, and new features shipped to TokenBuzz.
            </p>
          </div>

          {/* Empty state */}
          {releases.length === 0 && (
            <div
              style={{
                padding:      '48px 32px',
                textAlign:    'center',
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                borderRadius: 'var(--r-3)',
              }}
            >
              <div
                style={{
                  fontFamily:    'var(--font-mono)',
                  fontSize:      24,
                  color:         'var(--fg-3)',
                  marginBottom:  12,
                }}
              >
                —
              </div>
              <p
                style={{
                  font:   '400 16px/1.6 var(--font-sans)',
                  color:  'var(--fg-3)',
                  margin: 0,
                }}
              >
                No releases yet — check back soon.
              </p>
            </div>
          )}

          {/* Release list */}
          {releases.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
              {releases.map(release => (
                <article
                  key={release.id}
                  style={{
                    borderTop:   '1px solid var(--border)',
                    paddingTop:  40,
                  }}
                >
                  {/* Release meta */}
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display:       'flex',
                        alignItems:    'baseline',
                        gap:           12,
                        flexWrap:      'wrap',
                        marginBottom:  8,
                      }}
                    >
                      <h2
                        style={{
                          fontFamily:    'var(--font-display)',
                          fontSize:      'clamp(22px, 3vw, 30px)',
                          lineHeight:    1.1,
                          letterSpacing: '0.01em',
                          textTransform: 'uppercase',
                          color:         'var(--fg-1)',
                          margin:        0,
                        }}
                      >
                        {release.name || release.tag_name}
                      </h2>
                      <span
                        style={{
                          fontFamily:    'var(--font-mono)',
                          fontSize:      11,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color:         'var(--buzz-500)',
                          background:    'var(--accent-soft)',
                          padding:       '3px 8px',
                          borderRadius:  'var(--r-1)',
                          whiteSpace:    'nowrap',
                        }}
                      >
                        {release.tag_name}
                      </span>
                    </div>
                    {release.published_at && (
                      <time
                        dateTime={release.published_at}
                        style={{
                          fontFamily:    'var(--font-mono)',
                          fontSize:      12,
                          letterSpacing: '0.06em',
                          color:         'var(--fg-3)',
                        }}
                      >
                        {formatDate(release.published_at)}
                      </time>
                    )}
                  </div>

                  {/* Release body */}
                  {release.body ? (
                    <div className="changelog-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {release.body}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p
                      style={{
                        font:   '400 14px/1.6 var(--font-sans)',
                        color:  'var(--fg-3)',
                        margin: 0,
                        fontStyle: 'italic',
                      }}
                    >
                      No release notes provided.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
