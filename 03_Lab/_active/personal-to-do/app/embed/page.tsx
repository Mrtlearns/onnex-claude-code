'use client'

import { useEffect, useRef } from 'react'
import { useUniverseStore } from '@/store/universe'
import UniverseCanvas from '@/components/universe/UniverseCanvas'

export default function EmbedPage() {
  const { fetchAll, nodes, createNode, selectNode } = useUniverseStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      fetchAll()
    }
  }, [fetchAll])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const { type, nodeId, data } = event.data ?? {}

      switch (type) {
        case 'KU_SELECT_NODE':
          selectNode(nodeId ?? null)
          break

        case 'KU_CREATE_NODE':
          createNode(data).then((node) => {
            if (node && event.source) {
              (event.source as Window).postMessage(
                { type: 'KU_NODE_CREATED', node },
                event.origin
              )
            }
          })
          break

        case 'KU_GET_NODES':
          if (event.source) {
            (event.source as Window).postMessage(
              { type: 'KU_NODES_RESULT', nodes },
              event.origin
            )
          }
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [nodes, createNode, selectNode])

  return (
    <div className="w-full h-screen overflow-hidden">
      <UniverseCanvas embedded />
    </div>
  )
}
