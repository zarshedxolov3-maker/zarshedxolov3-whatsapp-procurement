import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class Store {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_receipts (
        dedupe_key TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        processing_state TEXT NOT NULL,
        result_ref TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE REFERENCES event_receipts(dedupe_key),
        supplier_ref TEXT,
        model TEXT, storage TEXT, color TEXT, specification TEXT,
        quantity INTEGER, currency TEXT, price REAL, activation_status TEXT,
        sim_type TEXT CHECK(sim_type IN ('1-SIM','eSIM','unknown')),
        recommendation TEXT NOT NULL CHECK(recommendation IN ('BUY','NEGOTIATE','SKIP'))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS business_actions (
        action_key TEXT PRIMARY KEY,
        event_key TEXT NOT NULL REFERENCES event_receipts(dedupe_key),
        state TEXT NOT NULL,
        result_ref TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS outbox (
        action_key TEXT PRIMARY KEY REFERENCES business_actions(action_key),
        operation TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sent_mutations (
        idempotency_key TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        business_ref TEXT NOT NULL,
        state TEXT NOT NULL,
        result_ref TEXT
      ) STRICT;
    `);
  }

  persistEvent(event) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const inserted = this.db.prepare(`
        INSERT INTO event_receipts(dedupe_key,event_type,first_seen,processing_state)
        VALUES(?,?,?,'persisted') ON CONFLICT(dedupe_key) DO NOTHING
      `).run(event.dedupeKey, event.type, new Date().toISOString()).changes === 1;
      if (!inserted) {
        this.db.exec('COMMIT');
        return { duplicate: true };
      }
      if (event.offer) {
        const o = event.offer;
        this.db.prepare(`INSERT INTO offers(
          event_key,supplier_ref,model,storage,color,specification,quantity,currency,price,
          activation_status,sim_type,recommendation) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(event.dedupeKey,o.supplierRef,o.model,o.storage,o.color,o.specification,
          o.quantity,o.currency,o.price,o.activationStatus,o.simType,o.recommendation);
      }
      if (event.actionKey) {
        const freshAction = this.db.prepare(`INSERT INTO business_actions(action_key,event_key,state)
          VALUES(?,?,'queued') ON CONFLICT(action_key) DO NOTHING`
        ).run(event.actionKey,event.dedupeKey).changes === 1;
        if (freshAction) this.db.prepare(`INSERT INTO outbox(action_key,operation) VALUES(?,'analyze_offer')`).run(event.actionKey);
      }
      this.db.prepare('UPDATE event_receipts SET result_ref=? WHERE dedupe_key=?').run(event.dedupeKey,event.dedupeKey);
      this.db.exec('COMMIT');
      return { duplicate: false };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  reserveMutation(key, operation, businessRef) {
    this.db.prepare(`INSERT INTO sent_mutations(idempotency_key,operation,business_ref,state)
      VALUES(?,?,?,'reserved') ON CONFLICT(idempotency_key) DO NOTHING`).run(key,operation,businessRef);
    return this.db.prepare('SELECT * FROM sent_mutations WHERE idempotency_key=?').get(key);
  }
  finishMutation(key, state, resultRef=null) {
    this.db.prepare('UPDATE sent_mutations SET state=?,result_ref=? WHERE idempotency_key=?').run(state,resultRef,key);
  }
  counts() {
    return {
      events: this.db.prepare('SELECT count(*) n FROM event_receipts').get().n,
      actions: this.db.prepare('SELECT count(*) n FROM business_actions').get().n,
      outbox: this.db.prepare('SELECT count(*) n FROM outbox').get().n
    };
  }
  close() { this.db.close(); }
}
