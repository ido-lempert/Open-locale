import { ConflictException } from '@nestjs/common';
import { TasksService } from './tasks.service';

// The concurrent-assignment mapper must turn exactly one error - the FK
// violation on tasks_assigneeGroupId_fkey after the group was deleted
// mid-race - into a client-facing 409, and rethrow everything else
// unchanged so unrelated DB failures are never masked as client errors.
describe('rethrowUnlessAssigneeGroupDeleted', () => {
  const service = new TasksService(null as never, null as never, null as never);
  const map = (e: unknown) => (service as unknown as { rethrowUnlessAssigneeGroupDeleted(e: unknown): never }).rethrowUnlessAssigneeGroupDeleted(e);

  it('maps P2003 on the assignee-group constraint (message shape) to 409', () => {
    const err = Object.assign(new Error('Foreign key constraint violated on the constraint: `tasks_assigneeGroupId_fkey`'), { code: 'P2003' });
    expect(() => map(err)).toThrow(ConflictException);
  });

  it('maps P2003 on the assignee-group constraint (meta shape) to 409', () => {
    const err = Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003', meta: { constraint: { index: 'tasks_assigneeGroupId_fkey' } } });
    expect(() => map(err)).toThrow(ConflictException);
  });

  it('rethrows P2003 on a different constraint unchanged', () => {
    const err = Object.assign(new Error('Foreign key constraint violated on the constraint: `tasks_assigneeId_fkey`'), { code: 'P2003' });
    expect(() => map(err)).toThrow(err);
  });

  it('rethrows a different Prisma code unchanged', () => {
    const err = Object.assign(new Error('Unique constraint failed on the constraint: `tasks_assigneeGroupId_fkey`'), { code: 'P2002' });
    expect(() => map(err)).toThrow(err);
  });

  it('rethrows a non-Prisma error unchanged', () => {
    const err = new Error('connection reset tasks_assigneeGroupId_fkey');
    expect(() => map(err)).toThrow(err);
  });
});
