type Operation = () => Promise<void>;

/** Serialize explicit attempts. A failed mutation is never replayed automatically. */
export function createProfileActionRunner({
  onPending,
  onFailure,
}: {
  onPending: (pending: boolean) => void;
  onFailure: (failure: { error: unknown; retry: Operation } | null) => void;
}) {
  let busy = false;
  return {
    get busy() { return busy; },
    async run(operation: Operation) {
      if (busy) return false;
      busy = true;
      onPending(true);
      onFailure(null);
      try {
        await operation();
        return true;
      } catch (error) {
        onFailure({ error, retry: operation });
        return false;
      } finally {
        busy = false;
        onPending(false);
      }
    },
  };
}
