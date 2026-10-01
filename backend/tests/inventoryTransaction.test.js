const { Prisma } = require('@prisma/client');
const { inventoryTransaction } = require('../dist/services/inventoryTransaction');
const conflict = () => new Prisma.PrismaClientKnownRequestError('Test serialization conflict', { code: 'P2034', clientVersion: 'test' });
test('retries rolled-back serialization conflicts and returns the committed result', async () => {
  const tx = jest.fn().mockRejectedValueOnce(conflict()).mockResolvedValue('committed');
  await expect(inventoryTransaction({ $transaction: tx }, async () => {})).resolves.toBe('committed');
  expect(tx).toHaveBeenCalledTimes(2);
  expect(tx.mock.calls[0][1].isolationLevel).toBe('Serializable');
});
test('stops after four serialization attempts with a useful conflict response', async () => {
  const tx = jest.fn().mockRejectedValue(conflict());
  await expect(inventoryTransaction({ $transaction: tx }, async () => {})).rejects.toMatchObject({statusCode:409});
  expect(tx).toHaveBeenCalledTimes(4);
});
test('does not retry unknown failures or business errors', async () => {
  const failure = new Error('not a rolled-back transaction conflict');
  const tx = jest.fn().mockRejectedValue(failure);
  await expect(inventoryTransaction({ $transaction: tx }, async () => {})).rejects.toBe(failure);
  expect(tx).toHaveBeenCalledTimes(1);
});
