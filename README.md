# pixel agents

A Claude Code mod that draws each running subagent as an animated pixel character, in the terminal, under the prompt's hint line.

The main agent wears a crown. Each subagent gets its own desk, shirt color and label:

- It drops in when it starts.
- Its hands type while it runs `Bash`, `Edit` or `Write`.
- Its eyes scan while it runs `Read`, `Grep` or `Glob`.
- A thought bubble grows between tool calls.
- It raises its arms with a green check when it finishes, then fades out after 8 seconds.

The strip appears only while subagents are running. Otherwise the hint line is unchanged.

## Install

```
/plugin install pixel-agents --marketplace dimivelev/pixel-agents
```

Answer `y` to add the marketplace, then pick a scope.

## How it works

The mod uses Claude Code's function hooks:

- `agent.spawn` adds a character when a subagent starts.
- `tool.call` tracks which tool each agent is running. Each call carries the `agentId` of the loop it runs in.
- `turn.complete` marks a subagent done.
- `ui.render` on `PromptHint` draws the engine's own line, then a `Raster` of half-block cells below it, about five times a second.

| File | Contents |
| --- | --- |
| `hooks/register.tsx` | The hooks and per-agent state. |
| `hooks/sprites.ts` | Sprites, poses and cell encoding. |
| `tests/strip.test.tsx` | Behavior tests. Run them with `claude plugin test .`. |

## Previews

`previews/` holds two standalone terminal scripts that animate demo agents. Use them to compare looks before changing the sprites.

```
node previews/preview.mjs      # six styles: office, robots, cats, slimes, mini, parade
node previews/preview-hd.mjs   # shaded, anti-aliased characters at 16, 24, 32 and 44 px
```

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## License

MIT. See [LICENSE](LICENSE).
