import { useParams } from "react-router-dom";
import { openDB } from "idb";
import { unzip } from "unzipit";
import { SupportedProviders } from "./constants";

function Upload() {
  const params = useParams();
  const provider = SupportedProviders.find(p => p.slug === params.provider);

  async function uploadFile(event) {
    if (event.target.files.length < 1) {
      return;
    }

    const zip = await unzip(event.target.files[0]);
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
    for (const channel of channels) {
      await db.put("slack.channels", channel);
    }

    const integrationLogs = await zip.entries["integration_logs.json"].json();
    for (const log of integrationLogs) {
      await db.put("slack.integration_logs", log);
    }

    const users = await zip.entries["users.json"].json();
    for (const user of users) {
      await db.put("slack.users", user);
    }

    for (const name in zip.entries) {
      if (["channels.json", "integration_logs.json", "users.json"].includes(name)) continue;

      const entry = zip.entries[name];
      if (entry.isDirectory) continue;

      const channel = await db.getFromIndex("slack.channels", "name", name.split("/")[0]);
      const messages = await entry.json();
      console.warn(`Processing ${name} for ${channel}...`);
      for (const message of messages) {
        message.channel = channel.id;
        await db.put("slack.messages", message);
      }
    }
  }

  return (
    <div className="Upload">
      <div className="instructions">Upload data from {provider.displayName}...</div>
      <input type="file" accept=".zip,application/zip" onChange={uploadFile} />
    </div>
  );
}

export default Upload;
