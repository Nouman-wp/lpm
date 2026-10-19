import {
  agentProviderOfCommand,
  agentSessionOf,
  buildClaudeResumeCmd,
  type AgentSessionRef,
} from "../../agentSession";
import { buildCodexResumeCmd } from "../../codexResume";
import { followsAgentTitle, type TerminalInstance } from "../../paneTree";

// The tab once its agent has said which conversation it runs: Resume and Fork
// reopen that one, and a tab its agent titles lets go of an earlier
// conversation's title.
export function withAgentSession(
  tab: TerminalInstance,
  session: AgentSessionRef,
): TerminalInstance {
  const previous = agentSessionOf(tab);
  const changedSession =
    previous?.provider !== session.provider ||
    previous?.sessionId !== session.sessionId;
  const resumeCmd =
    session.provider === "claude"
      ? buildClaudeResumeCmd(tab.resumeCmd ?? tab.startCmd, session.sessionId)
      : buildCodexResumeCmd(
          agentProviderOfCommand(tab.startCmd) === "codex"
            ? tab.startCmd
            : undefined,
          session.sessionId,
        );

  return {
    ...tab,
    agentSession: {
      provider: session.provider,
      sessionId: session.sessionId,
    },
    resumeCmd,
    agentEnded: undefined,
    ...(changedSession && followsAgentTitle(tab)
      ? {
          sessionTitle: undefined,
          sessionTitleId: undefined,
          sessionTitleSource: undefined,
        }
      : {}),
  };
}
