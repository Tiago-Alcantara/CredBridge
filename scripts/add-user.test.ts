import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAddUserArguments } from './add-user';

test('parseAddUserArguments accepts email and role', () => {
  const result = parseAddUserArguments(['usuario@empresa.com', 'investor']);

  assert.deepEqual(result, {
    email: 'usuario@empresa.com',
    role: 'investor',
  });
});

test('parseAddUserArguments defaults role to pme', () => {
  const result = parseAddUserArguments(['usuario@empresa.com']);

  assert.deepEqual(result, {
    email: 'usuario@empresa.com',
    role: 'pme',
  });
});

test('parseAddUserArguments rejects invalid email', () => {
  assert.throws(
    () => parseAddUserArguments(['email-invalido']),
    /E-mail invalido/,
  );
});

test('parseAddUserArguments rejects invalid role', () => {
  assert.throws(
    () => parseAddUserArguments(['usuario@empresa.com', 'admin']),
    /Role invalida/,
  );
});
