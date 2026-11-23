import type { StoryEvent, StoryPack } from "../schemas/story-pack.ts";
import type { GameState } from "../state/game-state.ts";

export function availableEvents<Trigger extends StoryEvent["trigger"]>(
  pack: StoryPack, state: GameState, trigger: Trigger,
): Extract<StoryEvent, { trigger: Trigger }>[] {
  if (state.endingId !== null) return [];

  const history = new Set(state.eventHistory.map(event => event.storyEventId));
  const previous = state.eventHistory.findLast(event => event.sceneId === state.currentSceneId)?.storyEventId;
  return pack.events.filter((event): event is Extract<StoryEvent, { trigger: Trigger }> =>
    event.trigger === trigger &&
    event.sceneId === state.currentSceneId &&
    (!event.follows || (previous ? event.follows.includes(previous) : event.follows.length === 0)) &&
    (event.requiresEventIds ?? []).every(id => history.has(id)) &&
    !(event.excludesEventIds ?? []).some(id => history.has(id)) &&
    event.requiresClueIds.every((id) => state.discoveredClueIds.includes(id)) &&
    !state.eventHistory.some(({ storyEventId }) => storyEventId === event.id),
  );
}

export function availableInterventionEvents(pack: StoryPack, state: GameState) {
  return availableEvents(pack, state, "danmaku-intervention");
}

export function requireOpenEvent(
  pack: StoryPack,
  state: GameState,
  openEventIds: readonly string[],
  eventId: string,
): StoryEvent {
  const event = availableInterventionEvents(pack, state).find(({ id }) => id === eventId);
  if (!openEventIds.includes(eventId) || !event) {
    throw new Error(`Intervention event "${eventId}" is not open or eligible`);
  }
  return event;
}
