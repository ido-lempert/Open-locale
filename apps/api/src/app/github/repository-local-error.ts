// Domain errors only. Unexpected database/programming faults remain unclassified.
export class RepositoryLocalError extends Error {
  constructor(readonly kind: 'conflict' | 'unsupported' | 'backlog', message: string) {
    super(message);
    this.name = 'RepositoryLocalError';
  }
}
