const sql = require('mssql');
const fs = require('fs');
const path = require('path');

/**
 * Global MSSQL Connection Pool
 * Simplified version for SMS application
 */

// Global connection pool instance
let globalPool = null;
let connectionConfig = null;

// Persisted config path (stored alongside this file)
const PERSIST_PATH = path.join(__dirname, '.db_config.json');

function saveConfigToDisk(config) {
  try {
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('❌ Failed to persist DB config:', e.message);
    return false;
  }
}

function loadConfigFromDisk() {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return null;
    const raw = fs.readFileSync(PERSIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed || null;
  } catch (e) {
    console.error('❌ Failed to load persisted DB config:', e.message);
    return null;
  }
}

function clearConfigOnDisk() {
  try {
    if (fs.existsSync(PERSIST_PATH)) fs.unlinkSync(PERSIST_PATH);
  } catch (e) {
    console.error('❌ Failed to remove persisted DB config:', e.message);
  }
}

/**
 * Initialize global database connection
 * @param {Object} config - Database connection configuration
 * @returns {Promise<Object>} Connection result
 */
const initializeConnection = async (config) => {
  try {
    // Validate required configuration parameters
    if (
      !config.server ||
      !config.database ||
      !config.user ||
      !config.password
    ) {
      throw new Error('Missing required database configuration parameters');
    }

    // Store configuration for future use
    connectionConfig = {
      server: config.server,
      database: config.database,
      user: config.user,
      password: config.password,
      port: Number(config.port || 1433),
      options: {
        encrypt: config.encrypt !== false,
        trustServerCertificate: config.trustServerCertificate !== false,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
      parseJSON: true,
    };

    // Close existing pool if it exists
    if (globalPool) {
      await globalPool.close();
    }

    // Create new connection pool
    globalPool = await sql.connect(connectionConfig);

    console.log(
      `✅ Database connection established to ${config.server}/${config.database}`,
    );

    // Persist full config (including password) for auto-reconnect on next start
    saveConfigToDisk({
      server: config.server,
      database: config.database,
      user: config.user,
      password: config.password,
      port: connectionConfig.port,
      encrypt: connectionConfig.options.encrypt,
      trustServerCertificate: connectionConfig.options.trustServerCertificate,
    });

    return {
      success: true,
      message: 'Database connection established successfully',
      config: {
        server: config.server,
        database: config.database,
        user: config.user,
        port: connectionConfig.port,
      },
    };
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    globalPool = null;
    connectionConfig = null;

    return {
      success: false,
      message: 'Database connection failed',
      error: error.message,
    };
  }
};

/**
 * Execute a SQL query with the global connection
 * @param {string} query - SQL query to execute
 * @param {Object} [params] - Query parameters
 * @returns {Promise<Object>} Query execution result
 */
const executeQuery = async (query, params = {}) => {
  try {
    if (!globalPool) {
      throw new Error(
        'No active database connection. Please initialize connection first.',
      );
    }

    const request = globalPool.request();

    // Add parameters to the request
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.query(query);

    return {
      success: true,
      message: 'Query executed successfully',
      data: result.recordset,
      rowsAffected: result.rowsAffected[0],
    };
  } catch (error) {
    console.error('❌ Query execution failed:', error.message);
    return {
      success: false,
      message: 'Query execution failed',
      error: error.message,
    };
  }
};

/**
 * Check if database connection is active
 * @returns {boolean} Connection status
 */
const isConnected = () => {
  return !!globalPool;
};

/**
 * Close the global database connection pool
 * @returns {Promise<Object>} Close operation result
 */
const closeConnection = async () => {
  try {
    if (globalPool) {
      await globalPool.close();
      globalPool = null;
      connectionConfig = null;
      console.log('✅ Database connection closed');

      // Clear persisted config to disable auto-reconnect
      clearConfigOnDisk();

      return {
        success: true,
        message: 'Database connection closed successfully',
      };
    }

    return {
      success: true,
      message: 'No active database connection to close',
    };
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
    return {
      success: false,
      message: 'Failed to close database connection',
      error: error.message,
    };
  }
};

/**
 * Attempt to load persisted config and connect on server start
 */
const loadPersistedConnectionIfAny = async () => {
  try {
    if (globalPool) return { success: true, message: 'Already connected' };
    const persisted = loadConfigFromDisk();
    if (!persisted) {
      return { success: false, message: 'No persisted DB config found' };
    }
    const result = await initializeConnection(persisted);
    if (result.success) {
      return {
        success: true,
        message: 'Auto-connected using persisted config',
      };
    }
    return {
      success: false,
      message: 'Persisted config failed to connect',
      error: result.error,
    };
  } catch (e) {
    return { success: false, message: 'Auto-connect error', error: e.message };
  }
};

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down database connections...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Shutting down database connections...');
  await closeConnection();
  process.exit(0);
});

module.exports = {
  initializeConnection,
  executeQuery,
  isConnected,
  closeConnection,
  loadPersistedConnectionIfAny,
};

/* 
use ESDb
SELECT  dbo.student.CampusCode, dbo.student.fldCell1
FROM    dbo.student LEFT OUTER JOIN
dbo.student_class ON dbo.student.SystemCode = dbo.student_class.SystemCode AND dbo.student.CampusCode = dbo.student_class.CampusCode AND dbo.student.RegCode = dbo.student_class.RegCode
WHERE  (dbo.student_class.Active = 1) AND (dbo.student_class.SessionCode =
(SELECT MAX(SessionCode) AS Expr1
FROM dbo.Session
WHERE   (Active = 1))) AND (dbo.student.Active = 1)


use ESDB 
SELECT campuscode from tblcampus WHERE Active=1

*/
