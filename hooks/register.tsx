import type { Register } from 'claude-code'

import { type Agent, DONE_LINGER_MS, drawCards, toBase64 } from './sprites'

const FRAME_MS = 200
const PER_LINE = 6

export const register: Register = (on) => {
  const agents = new Map<string, Agent>()
  const main: Agent = { id: 'main', name: 'main', type: 'session', boss: true, calls: 0, born: 0 }

  const visible = (now: number) => {
    for (const [id, a] of agents) if (a.endedAt !== undefined && now - a.endedAt > DONE_LINGER_MS) agents.delete(id)
    return agents.size ? [main, ...agents.values()] : []
  }

  on('session.start', async ($, e, next) => {
    main.born = await $.clock.now()
    let wasShown = false
    $.clock.every(FRAME_MS, () => {
      if (agents.size || wasShown) $.ui.invalidate('ui.render')
      wasShown = agents.size > 0
    })
    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    main.idle = false
    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if ('agentId' in result && result.agentId) {
      agents.set(result.agentId, {
        id: result.agentId,
        name: e.description || e.subagentType,
        type: e.subagentType,
        model: result.model,
        calls: 0,
        born: await $.clock.now(),
      })
    }
    return result
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('tool.call', async ($, e, next) => {
    const actor = e.agentId ? agents.get(e.agentId) : main
    if (!actor || actor.endedAt !== undefined) return next(e)
    actor.tool = e.tool
    actor.calls += 1
    try {
      return await next(e)
    } finally {
      if (actor.tool === e.tool) actor.tool = undefined
    }
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) main.idle = true
    const agent = e.agentId ? agents.get(e.agentId) : undefined
    if (agent) Object.assign(agent, { endedAt: await $.clock.now(), tool: undefined })
    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const now = await $.clock.now()
    const shown = visible(now)
    if (!shown.length || e.surface !== 'terminal') return next(e)
    const { columns, rows, words } = drawCards(shown, now, Math.floor(now / FRAME_MS), PER_LINE)
    const { Box, Raster } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Raster key="pixel-agents" columns={columns} rows={rows} cells={toBase64(words)} />
      </Box>
    )
  })
}
