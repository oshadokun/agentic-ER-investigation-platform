'use strict';
/**
 * lib/job-queue.js
 *
 * In-process async job queue for AI operations.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAP POINT FOR PERSISTENT QUEUE
 * ─────────────────────────────────────────────────────────────────────────────
 * This implementation stores jobs in a plain Map (in-process, single-user mode).
 * Jobs are lost on server restart.
 *
 * To swap in a persistent queue (Redis + BullMQ, SQS, PostgreSQL-backed):
 *   1. Replace the `enqueue` body: serialise type + payload to the external queue;
 *      return the external job ID.
 *   2. Replace the `status` body: look up the job in the external queue.
 *   3. Replace the `result` body: retrieve the completed result from the store.
 *   4. Run the worker separately (or in-process via queue.process()).
 *
 * The interface (enqueue / status / result) is the stable contract.
 * All call sites use only these three functions — nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Interface:
 *
 *   enqueue(type, payload, executorFn) → job_id (string UUID)
 *     Schedules the executorFn to run asynchronously. Returns immediately.
 *     executorFn: async (payload) => result
 *
 *   status(job_id) → { id, type, status, created_at, updated_at } | null
 *     status values: 'pending' | 'running' | 'completed' | 'failed'
 *
 *   result(job_id) → { status, result?, error? } | null
 *     Returns the result (or error) once the job is completed/failed.
 *     Returns null if the job does not exist or is still running.
 */

const { randomUUID } = require('crypto');

// In-process store — swap point for external queue
const _jobs = new Map();

/**
 * Enqueues an AI job. The executorFn runs asynchronously via setImmediate
 * so the HTTP response is returned before work begins.
 *
 * @param {string}   type        - Label, e.g. 'case.intake' | 'document.generate'
 * @param {object}   payload     - Passed unchanged to executorFn
 * @param {Function} executorFn  - async (payload) => result
 * @returns {string} job_id
 */
function enqueue(type, payload, executorFn) {
  const id  = randomUUID();
  const job = {
    id,
    type,
    status:     'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    result:     null,
    error:      null,
  };
  _jobs.set(id, job);

  setImmediate(async () => {
    job.status     = 'running';
    job.updated_at = new Date().toISOString();
    try {
      job.result     = await executorFn(payload);
      job.status     = 'completed';
    } catch (err) {
      job.error      = err.message;
      job.status     = 'failed';
    }
    job.updated_at = new Date().toISOString();
  });

  return id;
}

/**
 * Returns the current status of a job.
 * @param {string} id
 * @returns {{ id, type, status, created_at, updated_at } | null}
 */
function status(id) {
  const job = _jobs.get(id);
  if (!job) return null;
  return {
    id:         job.id,
    type:       job.type,
    status:     job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

/**
 * Returns the result of a completed or failed job.
 * Returns { status, result } on success or { status, error } on failure.
 * Returns null if the job does not exist or is still pending/running.
 *
 * @param {string} id
 * @returns {{ status: string, result?: any, error?: string } | null}
 */
function result(id) {
  const job = _jobs.get(id);
  if (!job) return null;
  if (job.status === 'completed') return { status: 'completed', result: job.result };
  if (job.status === 'failed')    return { status: 'failed',    error:  job.error  };
  return { status: job.status };
}

module.exports = { enqueue, status, result };
