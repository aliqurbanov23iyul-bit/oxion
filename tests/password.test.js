import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, passwordCheck } from '../server/core.js';

test('password policy accepts eight characters and rejects shorter or oversized input', async () => {
  await assert.rejects(passwordHash('1234567'), {code:'PASSWORD_LENGTH'});
  await assert.rejects(passwordHash('a'.repeat(129)), {code:'PASSWORD_LENGTH'});
  const stored = await passwordHash('Eight-8!');
  assert.notEqual(stored, 'Eight-8!');
  assert.equal(await passwordCheck('Eight-8!', stored), true);
  assert.equal(await passwordCheck('wrong-8!', stored), false);
});
