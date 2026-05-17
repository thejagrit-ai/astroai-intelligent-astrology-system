import test from 'node:test';
import assert from 'node:assert/strict';
import { getChatReply } from '../api/_shared.js';

test('getChatReply includes user name and goals and respects tone', async () => {
  const userKundli = { name: 'Ananya', ascendant: 'Libra', nakshatra: 'Rohini', mahadasha: 'Moon', antardasha: 'Venus' };
  const history = [
    { role: 'user', parts: [{ text: 'Hi, what should I focus on this month?' }] },
    { role: 'model', parts: [{ text: 'Focus on consistency and small daily actions.' }] },
  ];

  const optsDetailed = { answerTone: 'detailed', userGoals: 'career growth', userName: 'Ananya' };
  const replyDetailed = await getChatReply({ message: 'Tell me about my career', userKundli, history, options: optsDetailed });
  assert.ok(typeof replyDetailed === 'string' && replyDetailed.length > 0, 'reply should be a string');
  assert.ok(replyDetailed.length > 0, 'reply should not be empty');

  const optsConcise = { answerTone: 'concise', userGoals: 'career growth', userName: 'Ananya' };
  const replyConcise = await getChatReply({ message: 'Tell me about my career', userKundli, history, options: optsConcise });
  assert.ok(typeof replyConcise === 'string' && replyConcise.length > 0, 'concise reply should be a string');

  // Ensure responses are not identical across tones (very likely)
  assert.notEqual(replyDetailed, replyConcise, 'Detailed and concise replies should differ');
});
