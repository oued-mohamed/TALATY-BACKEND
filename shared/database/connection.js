const { Pool } = require('pg');
const config = require('../config/database');

class DatabaseConnection {
  constructor() {
    this.pool = new Pool(config.database);
  }

  async query(text, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction(queries) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      
      for (const { text, params } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new DatabaseConnection();