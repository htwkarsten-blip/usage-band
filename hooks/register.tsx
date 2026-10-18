import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const PANE = 'usage-band'
const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])

const label = (kind: string) =>
  kind === 'five_hour' ? 'Sitzungslimit' : kind === 'seven_day' ? 'Wöchentliches Limit' : kind

const summary = (ls: Limit[]) =>
  ls.length
    ? ls.map(l => `${label(l.kind)}: ${Math.round(l.percentUsed)} %`).join('  ·  ')
    : 'noch keine Limit-Daten gemeldet'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'nutzung', description: 'Zeigt die aktuelle Nutzung in Prozent' })
    void $.ui.open({ id: PANE, title: 'Nutzung' })
    let note = 'usage-band geladen'
    try {
      const u = await $.session.usage()
      await update($, limits, () => u.rateLimits)
      note += ' – ' + summary(u.rateLimits)
      if (u.rateLimits.length) $.ui.status(summary(u.rateLimits))
    } catch {
      note += ' – Abfrage fehlgeschlagen'
    }
    $.ui.toast(note)
    return next(e)
  })

  on('command.run', { command: 'nutzung' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Nutzung' })
    const u = await $.session.usage()
    await update($, limits, () => u.rateLimits)
    return {
      text: `Nutzung: ${summary(u.rateLimits)}\nKontext: ${u.context.percent ?? '?'} %`,
    }
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits)
    $.ui.status(e.rateLimits.length ? summary(e.rateLimits) : undefined)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const ls = await read($, limits)
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>Nutzung  {summary(ls)}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const ls = await read($, limits)
    return (
      <Box flexDirection="column">
        {ls.length === 0 && <Text dimColor>Noch keine Limit-Daten gemeldet.</Text>}
        {ls.map(l => (
          <Text>
            {label(l.kind)}: {Math.round(l.percentUsed)} % verbraucht
          </Text>
        ))}
      </Box>
    )
  })
}
