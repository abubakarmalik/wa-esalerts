// server/src/config/db.js
// MSSQL connection pool + helpers with persisted config auto-reconnect

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

let globalPool = null;
let connectionConfig = null;

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
    return JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf8'));
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

const initializeConnection = async (config) => {
  try {
    if (
      !config.server ||
      !config.database ||
      !config.user ||
      !config.password
    ) {
      throw new Error('Missing required database configuration parameters');
    }

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

    if (globalPool) await globalPool.close();
    globalPool = await sql.connect(connectionConfig);

    console.log(
      `✅ Database connection established to ${config.server}/${config.database}`,
    );

    saveConfigToDisk({
      server: config.server,
      database: config.database,
      user: config.user,
      password: config.password, // stored locally; keep host secure
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

const executeQuery = async (query, params = {}) => {
  try {
    if (!globalPool)
      throw new Error(
        'No active database connection. Please initialize connection first.',
      );
    const request = globalPool.request();
    Object.keys(params).forEach((k) => request.input(k, params[k]));
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

const isConnected = () => !!globalPool;

const closeConnection = async () => {
  try {
    if (globalPool) {
      await globalPool.close();
      globalPool = null;
      connectionConfig = null;
      console.log('✅ Database connection closed');
      clearConfigOnDisk();
      return {
        success: true,
        message: 'Database connection closed successfully',
      };
    }
    return { success: true, message: 'No active database connection to close' };
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
    return {
      success: false,
      message: 'Failed to close database connection',
      error: error.message,
    };
  }
};

const loadPersistedConnectionIfAny = async () => {
  try {
    if (globalPool) return { success: true, message: 'Already connected' };
    const persisted = loadConfigFromDisk();
    if (!persisted)
      return { success: false, message: 'No persisted DB config found' };
    const result = await initializeConnection(persisted);
    if (result.success)
      return {
        success: true,
        message: 'Auto-connected using persisted config',
      };
    return {
      success: false,
      message: 'Persisted config failed to connect',
      error: result.error,
    };
  } catch (e) {
    return { success: false, message: 'Auto-connect error', error: e.message };
  }
};

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
WHERE  (dbo.student_class.Active = 1) AND (dbo.student_class.SessionCode =(SELECT MAX(SessionCode) AS Expr1 FROM dbo.Session WHERE   (Active = 1))) 
AND (dbo.student.Active = 1)
//

use ESDb

declare @BranchCode nvarchar(10) = 'All'

SELECT  dbo.student.CampusCode, dbo.student.fldCell1
FROM    dbo.student LEFT OUTER JOIN
dbo.student_class ON dbo.student.SystemCode = dbo.student_class.SystemCode AND dbo.student.CampusCode = dbo.student_class.CampusCode AND dbo.student.RegCode = dbo.student_class.RegCode
WHERE  (dbo.student_class.Active = 1) AND (dbo.student_class.SessionCode =(SELECT MAX(SessionCode) AS Expr1 FROM dbo.Session WHERE   (Active = 1))) 
AND (dbo.student.Active = 1)
and 
Cast(dbo.student.CampusCode as nvarchar(10)) like Case when @BranchCode = 'All' Then '%' else @BranchCode end
//

use ESDB 
SELECT campuscode from tblcampus WHERE Active=1

*/
