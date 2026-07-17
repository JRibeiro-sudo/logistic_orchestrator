import { useEffect, useRef } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUIStore } from '@/stores/ui'

/** Embeds the original animated orchestration diagram (docs/index.html)
 *  unchanged — it is a self-contained artifact with its own Start/Stop
 *  player and interactive Approve/Reject checkpoint. Only a theme-sync
 *  shim was added so it follows the workspace theme. */
export default function LiveFlow() {
  const theme = useUIStore((s) => s.theme)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'set-theme', theme }, '*')
  }, [theme])

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b bg-card px-4 py-3 lg:px-6">
        <PageHeader
          title="Live Recovery Flow"
          description="The end-to-end orchestration pipeline, animated. Press Start inside the canvas — it runs three scenarios and pauses at the human checkpoint for your Approve/Reject decision."
        />
      </div>
      <iframe
        ref={frameRef}
        src={`live-flow.html?theme=${theme}`}
        title="Animated recovery orchestration diagram"
        className="min-h-0 w-full flex-1 border-0 bg-background"
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage({ type: 'set-theme', theme }, '*')
        }
      />
    </div>
  )
}
