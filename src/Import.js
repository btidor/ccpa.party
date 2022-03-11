// @flow
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { getProvider } from "provider";

function Import(): React.Node {
  const params = useParams();
  const provider = getProvider(params.provider);
  const [status, setStatus] = React.useState("");

  async function importFile(event) {
    if (event.target.files.length < 1) {
      return;
    }

    setStatus("Importing...");
    const start = Date.now();
    await provider.import(event.target.files[0]);
    setStatus(
      <React.Fragment>
        <div>Import complete!</div>
        <Link to={`/explore/${provider.slug}`} className="box-link">
          View results
        </Link>
      </React.Fragment>
    );
    console.warn(`Time: ${(Date.now() - start) / 1000}s`);
  }

  return (
    <main>
      <div>Import data from {provider.displayName}...</div>
      <input type="file" accept=".zip,application/zip" onChange={importFile} />
      <div>{status}</div>
    </main>
  );
}

export default Import;
