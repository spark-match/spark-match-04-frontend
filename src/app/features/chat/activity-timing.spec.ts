import { ChatActivity } from './chat.model';
import { activityTimingLabel } from './activity-timing';

function activity(overrides: Partial<ChatActivity> = {}): ChatActivity {
  return { id: 'tc-1', label: 'x', kind: 'tool', running: false, ...overrides };
}

describe('activityTimingLabel', () => {
  it('is empty while the call is still running', () => {
    // Un contador subiendo distraería del texto que se está escribiendo.
    expect(activityTimingLabel(activity({ running: true, durationMs: 500 }))).toBe('');
  });

  it('says a failed delegation could not be completed', () => {
    expect(activityTimingLabel(activity({ ok: false }))).toBe(' · no pudo completarse');
  });

  it('is empty when there is no duration to report', () => {
    // Las herramientas normales (no subagentes) no traen duración.
    expect(activityTimingLabel(activity())).toBe('');
  });

  it('shows milliseconds as-is below one second', () => {
    expect(activityTimingLabel(activity({ durationMs: 320 }))).toBe(' · 320 ms');
  });

  it('rounds to one decimal in seconds at or above one second', () => {
    expect(activityTimingLabel(activity({ durationMs: 8400 }))).toBe(' · 8.4 s');
  });
});
