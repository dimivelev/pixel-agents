import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

function engineHint(on: On) {
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.hint}</Text>
  })
}

const HINT = {
  plugin: 'pixel-agents',
  surface: 'terminal',
  component: 'PromptHint',
  props: { isDraft: false, isWorking: true, hint: '⏵⏵ bypass permissions on' },
} as const

test('the hint line is untouched while no subagent runs', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engineHint(on)
  const ui = await $.ui.mount(HINT)
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('⏵⏵ bypass permissions on')
})

test('a spawned subagent draws a pixel strip under the hint', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engineHint(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a-survey' }))
  await $.agent.spawn({ prompt: 'count skills', description: 'Survey skills', subagentType: 'general-purpose' })

  const ui = await $.ui.mount(HINT)
  const strip = await ui.find({ type: 'Raster', key: 'pixel-agents' })
  expect(strip?.props).toMatchObject({ columns: 32, rows: 8 })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('⏵⏵ bypass permissions on')
})
