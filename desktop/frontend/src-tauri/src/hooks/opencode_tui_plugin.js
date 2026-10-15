// lpm status plugin: shows the sessions this OpenCode 2 terminal works in as the
// status of the lpm terminal tab it runs in. lpm writes this file and rewrites
// it when it changes. # lpm-hook

// OpenCode 2 sends every terminal the events of every session its background
// service runs, so a turn is this terminal's when it starts in the session the
// terminal shows, and is followed to its end wherever the user goes meanwhile.
// A sub-agent's session works inside its parent's turn: its questions and
// approvals are the parent's, its own start and finish are not reported. A turn
// still live when the terminal closes goes on in the service, out of sight.
export default {
  id: "lpm.status.tui",
  setup: (api) => {
    const turns = lpmTurns()
    const parents = new Map()
    const asks = new Map()

    const top = (id) => {
      while (parents.has(id)) id = parents.get(id)
      return api.data.session.root(id) ?? id
    }
    const shown = (id) => {
      const route = api.ui.router.current()
      return route?.type === "session" && top(route.sessionID) === id
    }
    const ours = (id) => top(id) === id && Boolean(turns.state(id) || shown(id))
    const end = (id, state) => {
      asks.delete(id)
      turns.end(id, state)
    }
    const asked = (sessionID, requestID) => {
      const id = top(sessionID)
      if (!turns.state(id)) return
      asks.set(id, (asks.get(id) ?? new Set()).add(requestID))
      turns.enter(id, "waiting")
    }
    const answered = (sessionID, requestID) => {
      const id = top(sessionID)
      asks.get(id)?.delete(requestID)
      if (!asks.get(id)?.size && turns.state(id) === "waiting") turns.enter(id, "running")
    }

    const stop = api.data.listen(({ details: event }) => {
      const p = event.data ?? {}
      switch (event.type) {
        case "session.created":
          if (p.parentID) parents.set(p.sessionID, p.parentID)
          break
        case "session.execution.started":
          if (ours(p.sessionID) && turns.state(p.sessionID) !== "waiting") turns.enter(p.sessionID, "running")
          break
        case "session.execution.succeeded":
          end(p.sessionID, "done")
          break
        case "session.execution.failed":
          end(p.sessionID, "error")
          break
        case "session.execution.interrupted":
          end(p.sessionID, "clear")
          break
        case "session.deleted":
          if (!parents.delete(p.sessionID)) end(p.sessionID, "clear")
          break
        case "permission.asked":
          asked(p.sessionID, p.id)
          break
        case "permission.replied":
          answered(p.sessionID, p.requestID)
          break
        case "form.created":
          asked(p.form?.sessionID, p.form?.id)
          break
        case "form.replied":
        case "form.cancelled":
          answered(p.sessionID, p.id)
          break
      }
    })

    return () => {
      stop()
      for (const id of turns.live()) end(id, "clear")
      return turns.settled()
    }
  },
}
