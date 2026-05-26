import type { DragEvent } from 'react'
import { HUM_CONTEXT_MIME, HUM_OPEN_EVENT, serializeContext, type HumStagedContext } from './humContext'

/** Spread onto any element to make it a Hum drag source. Opens the panel on drag start. */
export function humDragProps(item: HumStagedContext) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(HUM_CONTEXT_MIME, serializeContext(item))
      e.dataTransfer.effectAllowed = 'copy'
      window.dispatchEvent(new CustomEvent(HUM_OPEN_EVENT))
    },
  }
}
