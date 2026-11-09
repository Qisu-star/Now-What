import { ApiError, createPlacement, updatePlacement } from './api'
import type { DragPayload } from './drag'
import { toast } from './toast'

/** 拖拽落点统一入口：日视图和周视图共用 */
export async function applyDrop(
  payload: DragPayload,
  onChanged: () => void
): Promise<void> {
  if (!payload.valid) {
    toast('该时段已被占用')
    return
  }

  try {
    if (payload.mode === 'create') {
      await createPlacement({
        taskId: payload.taskId,
        day: payload.day,
        startMinute: payload.start,
        endMinute: payload.end
      })
      toast('已安排')
    } else if (payload.placementId) {
      await updatePlacement(payload.placementId, {
        day: payload.day,
        startMinute: payload.start,
        endMinute: payload.end
      })
      toast('已调整')
    }
    onChanged()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast('该时段已被占用')
    } else {
      toast(error instanceof Error ? error.message : '操作失败')
    }
    onChanged()
  }
}
