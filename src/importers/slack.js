// @flow
import { openDB } from "idb";
import { unzip } from "unzipit";

async function importSlack(file: File) {
  const zip = await unzip(file);
  const db = await openDB("data", 1, {
    async upgrade(db) {
      const channels = await db.createObjectStore("slack.channels", { keyPath: "id" });
      channels.createIndex("name", "name", { unique: true });

      db.createObjectStore("slack.integration_logs", { keyPath: "_id", autoIncrement: true });
      db.createObjectStore("slack.messages", { keyPath: ["channel", "ts"] })
      db.createObjectStore("slack.users", { keyPath: "id" });
    }
  });

  const channels = await zip.entries["channels.json"].json();
  const tx1 = db.transaction("slack.channels", "readwrite");
  for (const channel of channels) {
    await tx1.store.put(channel);
  }
  await tx1.done;

  const integrationLogs = await zip.entries["integration_logs.json"].json();
  const tx2 = db.transaction("slack.integration_logs", "readwrite");
  for (const log of integrationLogs) {
    await tx2.store.put(log);
  }
  await tx2.done;

  const users = await zip.entries["users.json"].json();
  const tx3 = db.transaction("slack.users", "readwrite");
  for (const user of users) {
    await tx3.store.put(user);
  }
  await tx3.done;

  const files = Object.entries(zip.entries).filter(([name, entry]) => {
    if (["channels.json", "integration_logs.json", "users.json"].includes(name)) return false;
    if (!entry) return false;
    if (entry.isDirectory) return false;
    return true;
  });
  for (let i = 0; i < files.length; i += 25) {
    const data = await Promise.all(files.slice(i, i + 25).map(async ([name, entry]) =>
      [await db.getFromIndex("slack.channels", "name", name.split("/")[0]), await (entry: any).json()]
    ));
    const tx = db.transaction("slack.messages", "readwrite");
    for (const [channel, messages] of data) {
      for (const message of messages) {
        message.channel = channel.id;
        await tx.store.put(message);
      }
    }
    await tx.done;
  }
}

export default importSlack;
