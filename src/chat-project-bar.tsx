import React, { useEffect, useState } from 'react'
import sdk from 'momai:sdk'

export default function ChatProjectBar() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    void sdk.api
      .get('/extensions/momai-docs/projects')
      .then((res: any) => {
        const list = res?.data?.projects || []
        setProjects(list)
        if (list[0]) setSelectedId(list[0].id)
      })
      .catch(() => {})
  }, [])

  if (projects.length === 0) return null

  return (
    <div className="px-2.5 py-1.5 flex items-center gap-2 text-[11px] text-text-muted">
      <span className="font-medium text-text">MomAI Docs</span>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="px-2 py-1 rounded-lg bg-input border border-border text-text text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}
