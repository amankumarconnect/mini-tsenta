import { useEffect, useState } from 'react'
import { FileText, ExternalLink, Calendar } from 'lucide-react'

interface Application {
  id: string
  jobTitle: string
  companyName: string
  jobUrl: string
  coverLetter: string
  status: string
  appliedAt: string
}

export function Dashboard({ onBack }: { onBack: () => void }) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [currentTab, setCurrentTab] = useState<'applied' | 'skipped'>('applied')

  useEffect(() => {
    const fetchApps = async () => {
      try {
        // @ts-ignore
        const apps = await window.api.getApplications()
        setApplications(apps)
      } catch (error) {
        console.error('Failed to load applications', error)
      } finally {
        setLoading(false)
      }
    }
    fetchApps()
  }, [])

  const filteredApps = applications.filter((app) => {
    if (currentTab === 'applied') return app.status !== 'skipped'
    return app.status === 'skipped'
  })

  if (loading) return <div className="p-4 text-center">Loading history...</div>

  return (
    <div className="flex-1 overflow-auto p-1 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Application History</h2>
        <button onClick={onBack} className="text-sm underline">
          Back to Automation
        </button>
      </div>

      <div className="flex space-x-2 border-b pb-2 mb-4">
        <button
          onClick={() => setCurrentTab('applied')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${currentTab === 'applied'
            ? 'bg-black text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Applied ({applications.filter((a) => a.status !== 'skipped').length})
        </button>
        <button
          onClick={() => setCurrentTab('skipped')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${currentTab === 'skipped'
            ? 'bg-black text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Skipped ({applications.filter((a) => a.status === 'skipped').length})
        </button>
      </div>

      {filteredApps.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No {currentTab} applications found.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="border rounded-lg p-3 bg-card text-card-foreground shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-md">{app.jobTitle}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{app.companyName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div
                  className={`text-xs px-2 py-1 rounded-full ${app.status === 'submitted'
                    ? 'bg-green-100 text-green-800'
                    : app.status === 'skipped'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100'
                    }`}
                >
                  {app.status}
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> View Job
                </a>
                <button
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  className="text-xs flex items-center gap-1 text-gray-600 hover:underline"
                >
                  <FileText className="w-3 h-3" />{' '}
                  {expandedId === app.id
                    ? app.status === 'skipped' ? 'Hide Reason' : 'Hide Cover Letter'
                    : app.status === 'skipped' ? 'Show Reason' : 'Show Cover Letter'}
                </button>
              </div>

              {expandedId === app.id && (
                <div className="mt-3 p-3 bg-muted/50 rounded text-xs whitespace-pre-wrap font-mono border">
                  {app.status === 'skipped' && <span className="font-bold">Skipped Reason: </span>}
                  {app.coverLetter}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
