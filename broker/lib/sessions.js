import { randomUUID } from 'crypto';

/** @typedef {{ conversationId: string, token: string }} Session */

const store = new Map();

export function createSessionId() {
  return randomUUID();
}

/** @param {string} id */
export function getSession(id) {
  return store.get(id) ?? null;
}

/** @param {string} id @param {Session} data */
export function setSession(id, data) {
  store.set(id, { ...data });
}

/** @param {string} id */
export function deleteSession(id) {
  store.delete(id);
}
