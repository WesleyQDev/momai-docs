import React, { useEffect, useState } from 'react'
import sdk from 'momai:sdk'

export default function DocsStudioWidget() {
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    void sdk.api
      .get('/extensions/momai-docs/projects')
      .then((res: any) => {
        if (res?.ok && Array.isArray(res.data?.projects)) {
          setProjects(res.data.projects.slice(0, 3))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="h-full w-full p-3.5 flex flex-col justify-between bg-card text-text rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight text-text">MomAI Docs</span>
        <span className="px-2 py-0.5 rounded-full bg-input border border-border text-[10px] font-medium text-accent tabular-nums">
          {projects.length} projetos
        </span>
      </div>
      <div className="space-y-1.5 my-1">
        {projects.length === 0 ? (
          <div className="text-[11px] text-text-muted">Nenhum projeto recente</div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[11px] text-text-muted truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span className="truncate">{p.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
