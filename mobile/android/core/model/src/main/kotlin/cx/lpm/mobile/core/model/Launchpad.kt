package cx.lpm.mobile.core.model

/**
 * Something a new tab can start with its prompt, as the desktop's empty project offers
 * it: a project action that opens an agent (and the split button or menu it sits in),
 * or a bare agent when the project has none.
 */
data class LaunchpadOption(
    val id: String,
    val label: String,
    val agent: String,
    val action: Action? = null,
    val group: Action? = null
)

/**
 * One entry of the New Tab sheet's Start list: a single option, or a header split
 * button or menu holding several.
 */
data class LaunchpadTab(
    val id: String,
    val label: String,
    val options: List<LaunchpadOption>,
    /** What the entry itself picks; null for a menu, which only opens. */
    val primary: LaunchpadOption?
)

/**
 * The project's actions that open one of [agents], split buttons and menus kept whole
 * with only their agent items, each split led by the item its button runs ([lastUsed]
 * names a `last-used` group's). The bare agents when the project has none. Mirrors the
 * desktop's launchpadTabs.
 */
fun launchpadTabs(
    actions: List<Action>,
    agents: List<AgentOption>,
    lastUsed: (group: String) -> String? = { null }
): List<LaunchpadTab> {
    val ids = agents.map { it.id }
    fun option(action: Action, group: Action? = null): LaunchpadOption? {
        if (action.type != "terminal") return null
        val agent = agentCli(action.cmd, ids) ?: return null
        return LaunchpadOption(action.name, action.label, agent, action, group)
    }
    fun descendants(actions: List<Action>): List<Action> =
        actions.flatMap { listOf(it) + descendants(it.children) }

    val tabs = actions.mapNotNull { action ->
        val own = option(action)
        val children = descendants(action.children).mapNotNull { option(it, action) }
        if (children.isEmpty()) {
            return@mapNotNull own?.let {
                LaunchpadTab(it.id, it.label, listOf(it), it)
            }
        }
        val options = listOfNotNull(own) + children
        val lead = action.primaryChild(lastUsed(action.name))
        val primary = options.firstOrNull { it.id == lead?.name }
            ?: options.firstOrNull()?.takeIf { lead != null || action.cmd.isNotEmpty() }
        LaunchpadTab(action.name, action.label, options, primary)
    }
    if (tabs.isNotEmpty()) return tabs
    return agents.map {
        val bare = LaunchpadOption(it.id, it.label, it.id)
        LaunchpadTab(bare.id, bare.label, listOf(bare), bare)
    }
}

private val COMMAND_WORD = Regex("""[^\s;&|]+""")
private val PROGRAM_EXTENSION = Regex("""\.(exe|cmd|bat)$""", RegexOption.IGNORE_CASE)

/**
 * The agent [cmd] starts: the first command word naming one of [agents] by its file
 * name (`/usr/local/bin/claude`, `codex.exe`). Mirrors the desktop's detectAICLI.
 */
fun agentCli(cmd: String, agents: List<String>): String? = COMMAND_WORD.findAll(cmd)
    .map { word ->
        val name = word.value.split('/', '\\').lastOrNull { it.isNotEmpty() } ?: word.value
        name.replace(PROGRAM_EXTENSION, "")
    }
    .firstOrNull { it in agents }
