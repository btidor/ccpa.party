// @flow
import * as React from "react";
import { Tree } from "react-arborist";
import { useNavigate } from "react-router-dom";
import { AutoSizer } from "react-virtualized";
import {
  BeakerIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DesktopDownloadIcon,
  FileCodeIcon,
  FileZipIcon,
} from "@primer/octicons-react";

import Navigation from "components/Navigation";
import Theme from "components/Theme";
import { Database, fileSizeLimitMB, smartDecode, parseJSON } from "database";

import styles from "Drilldown.module.css";

import type { DataFileKey, DataFile } from "database";
import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +selected?: number,
|};

type TreeNode = {|
  id: string,
  name: string,
  children: Array<TreeNode>,
  _childmap: Map<string, TreeNode>,
  item?: DataFileKey,
  index?: string,
|};

function Files(props: Props): React.Node {
  const navigate = useNavigate();
  const { provider, selected } = props;

  const [epoch, setEpoch] = React.useState(0);
  const db = React.useMemo(
    () => new Database(() => setEpoch(epoch + 1)),
    [epoch]
  );

  const [loaded, setLoaded] = React.useState(false);
  const [items, setItems] = React.useState(
    (undefined: ?$ReadOnlyArray<DataFileKey>)
  );
  React.useEffect(() => {
    (async () => {
      const items = await db.getFilesForProvider(provider);
      if (items.length === 0) navigate(`/${provider.slug}/import`);
      setItems(items);
    })();
  }, [db, navigate, provider]);

  const fileTree = React.useMemo(() => {
    const fileTree = ({
      id: "",
      name: "",
      children: [],
      _childmap: new Map(),
    }: TreeNode);
    for (let i = 0; items && i < items.length; i++) {
      const item = items[i];
      let node = fileTree;
      for (const part of item.path.slice(0, -1)) {
        let next = node._childmap.get(part);
        if (!next) {
          next = {
            id: `${node.id}/${part}`,
            name: part,
            children: [],
            _childmap: new Map(),
          };
          node.children.push(next);
          node._childmap.set(part, next);
        }
        node = next;
      }
      const leaf = {
        id: `${node.id}/${item.path.slice(-1)[0]}`,
        name: item.path.slice(-1)[0],
        children: [],
        _childmap: new Map(),
        item,
        index: i.toString(),
      };
      node.children.push(leaf);
      node._childmap.set(leaf.id, leaf);
    }
    return fileTree;
  }, [items]);

  const [item, setItem] = React.useState((undefined: DataFile | void));
  const [expanded, setExpanded] = React.useState(new Set());
  React.useEffect(() => {
    (async () => {
      if (!items) return;
      if (!selected || !items[selected]) {
        // By default, expand all root archives
        setExpanded(new Set(fileTree.children.map((n) => n.id)));
        setLoaded(true);
        return;
      }
      const item = await db.hydrateFile(items[selected]);
      setItem(item);
    })();
  }, [db, fileTree, items, selected]);

  React.useEffect(() => {
    // When loading the page with file selected, start with the path to that
    // file expanded.
    if (!item) return;
    const expanded = new Set();
    let path = "";
    for (const part of item.path) {
      path += "/" + part;
      expanded.add(path);
    }
    setExpanded(expanded);
    setLoaded(true);
  }, [item, loaded]);

  return (
    <Theme provider={provider}>
      <Navigation provider={provider} pageSlug="files" />
      <main className="thin">
        <div className={styles.container} style={{ "--left-width": "30vw" }}>
          <div className={styles.left}>
            <div className={styles.bar}></div>
            {!loaded || !items || items.length === 0 ? (
              <code className={styles.loading}>
                {loaded ? "😮 No Results" : "📊 Loading..."}
              </code>
            ) : (
              <div className={styles.treeDrilldown}>
                <AutoSizer>
                  {({ width, height }) => (
                    <Tree
                      data={fileTree}
                      width={width}
                      height={height}
                      indent={12}
                      rowHeight={21}
                      hideRoot
                      isOpen={(node) => !node.id || expanded.has(node.id)}
                      onToggle={(id, isCollapsed) => {
                        const updated = new Set(expanded);
                        if (isCollapsed) {
                          updated.add(id);
                        } else {
                          updated.delete(id);
                        }
                        setExpanded(updated);
                      }}
                    >
                      {({ styles: css, data, handlers }) => (
                        <div
                          className={styles.listItem}
                          style={css.row}
                          role="row"
                          aria-selected={selected && selected === data.index}
                          onClick={(event) => {
                            if (data.item) {
                              navigate(
                                `/${provider.slug}/files` +
                                  (selected === data.index
                                    ? ""
                                    : `@${data.index}`)
                              );
                            } else {
                              handlers.toggle(event);
                            }
                          }}
                        >
                          <div style={css.indent}>
                            {(() => {
                              if (data.item) {
                                return <FileCodeIcon />;
                              } else if (data.name.endsWith(".zip")) {
                                return <FileZipIcon />;
                              } else if (expanded.has(data.id)) {
                                return <ChevronDownIcon />;
                              } else {
                                return <ChevronRightIcon />;
                              }
                            })()}
                            {data.name}
                          </div>
                        </div>
                      )}
                    </Tree>
                  )}
                </AutoSizer>
              </div>
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.bar}>
              <span>
                {selected !== undefined &&
                  items?.[selected]?.path.slice(1).join("/")}
              </span>
              <div className={styles.grow}></div>
              {item && (
                <div
                  className={styles.download}
                  onClick={() => {
                    provider.parse(item).then((e) => console.warn(e));
                  }}
                >
                  <BeakerIcon />
                </div>
              )}
              {item && (
                <a
                  className={styles.download}
                  download={item.path.slice(-1)[0]}
                  href={URL.createObjectURL(new Blob([item.data]))}
                >
                  <DesktopDownloadIcon />
                </a>
              )}
            </div>
            <div className={styles.inspector}>
              {(() => {
                if (!selected) return;
                if (!item)
                  return <code className={styles.loading}>📊 Loading...</code>;
                if (item.skipped)
                  return (
                    <code className={styles.loading}>
                      🐘 Not imported due to {fileSizeLimitMB}MB size limit
                    </code>
                  );
                if (item.data.byteLength === 0)
                  return (
                    <code className={styles.loading}>
                      🥛 This file is empty
                    </code>
                  );

                const filenameParts = item.path.slice(-1)[0].split(".");
                const ext =
                  filenameParts.length < 2
                    ? undefined
                    : filenameParts.slice(-1)[0];
                switch (ext) {
                  case "json": {
                    try {
                      const parsed = parseJSON(item.data);
                      return <pre>{JSON.stringify(parsed, undefined, 2)}</pre>;
                    } catch {
                      const raw = smartDecode(item.data);
                      return <pre>{raw}</pre>;
                    }
                  }
                  case "csv":
                  case "txt":
                  case undefined: // eg. "README"
                  case "xml": {
                    const text = smartDecode(item.data);
                    return <pre>{text}</pre>;
                  }
                  case "pdf": {
                    const url = URL.createObjectURL(new Blob([item.data]));
                    return (
                      <object data={url} type="application/pdf">
                        <code className={styles.loading}>
                          🙅 Could not display PDF
                        </code>
                      </object>
                    );
                  }
                  case "htm":
                  case "html": {
                    const url = URL.createObjectURL(new Blob([item.data]));
                    return (
                      <iframe
                        src={url}
                        sandbox=""
                        title={filenameParts.join(".")}
                      ></iframe>
                    );
                  }
                  case "avif":
                  case "gif":
                  case "jpg":
                  case "jpeg":
                  case "png":
                  case "svg":
                  case "webp": {
                    const url = URL.createObjectURL(new Blob([item.data]));
                    return (
                      <React.Fragment>
                        <img
                          src={url}
                          alt={filenameParts.join(".")}
                          className={styles.media}
                        />
                      </React.Fragment>
                    );
                  }
                  default: {
                    return (
                      <code className={styles.loading}>
                        😕 Unknown file type
                      </code>
                    );
                  }
                }
              })()}
            </div>
          </div>
        </div>
      </main>
    </Theme>
  );
}

export default Files;
