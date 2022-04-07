// @flow
import initSqlJs from "@jlongster/sql.js";
import { SQLiteFS } from "absurd-sql";
import IndexedDBBackend from "absurd-sql/dist/indexeddb-backend";

const dbPromise = (async () => {
  // From https://github.com/jlongster/absurd-sql:
  let SQL = await initSqlJs({ locateFile: (file) => file });
  let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  SQL.register_for_idb(sqlFS);

  SQL.FS.mkdir("/sql");
  SQL.FS.mount(sqlFS, {}, "/sql");

  const path = "/sql/db.sqlite";
  if (typeof SharedArrayBuffer === "undefined") {
    let stream = SQL.FS.open(path, "a+");
    await stream.node.contents.readIfFallback();
    SQL.FS.close(stream);
  }

  let db = new SQL.Database(path, { filename: true });
  db.exec(`
    PRAGMA journal_mode=MEMORY;
    PRAGMA page_size=16384;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS parseds (
      provider VARCHAR(255) NOT NULL,
      file VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      timestamp INTEGER NOT NULL,
      day VARCHAR(255) NOT NULL,
      context VARCHAR(2550) NOT NULL,
      value VARCHAR(25500) NOT NULL
    );
  `);
  return db;
})();

const query = (db, query, bind) => {
  const stmt = db.prepare(query);
  stmt.bind(bind);

  const result = [];
  while (stmt.step()) {
    result.push(stmt.getAsObject());
  }
  return result;
};

onmessage = async ({ data }) => {
  const db = await dbPromise;
  const { id, command, params } = data;

  let response;
  if (command === "getParsedsForProvider") {
    const provider = params;
    response = query(db, "SELECT * FROM parseds WHERE provider=:provider", {
      ":provider": provider,
    }).map((e) => ({
      ...e,
      type: "timeline",
      context: JSON.parse(e.context),
      value: JSON.parse(e.value),
    }));
  } else if (command === "putParseds") {
    const [provider, entries] = params;
    for (const entry of entries) {
      db.exec(
        "INSERT INTO parseds VALUES (:provider, :file, :category, :timestamp, :day, :context, :value)",
        {
          ":provider": provider,
          ":file": entry.file,
          ":category": entry.category,
          ":timestamp": entry.timestamp,
          ":day": entry.day,
          ":context": JSON.stringify(entry.context),
          ":value": JSON.stringify(entry.value),
        }
      );
    }
  } else {
    console.error("Worker received unknown command", command);
  }

  // $FlowFixMe[cannot-resolve-name]
  postMessage({ id, response });
};
