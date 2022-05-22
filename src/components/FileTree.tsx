import React from "react";
import { Tree } from "react-arborist";
import { AutoSizer } from "react-virtualized";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileZipIcon,
} from "@primer/octicons-react";

import styles from "components/FileTree.module.css";

import type { DataFileKey } from "common/database";

type Props = {
  items: ReadonlyArray<DataFileKey>,
  selected?: number, // index into items
  onSelect: (id: number) => void,
};

type TreeNode = {
  id: string,
  name: string,
  children: Array<TreeNode>,
  _childmap: Map<string, TreeNode>,
  item?: DataFileKey,
  index?: number,
};

function fileListToTree(items: ReadonlyArray<DataFileKey>): TreeNode {
  const fileTree = ({
    id: "",
    name: "",
    children: [],
    _childmap: new Map(),
  } as TreeNode);
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
      index: i,
    };
    node.children.push(leaf);
    node._childmap.set(leaf.id, leaf);
  }
  return fileTree;
}

function FileTree(props: Props): JSX.Element {
  const { items, onSelect, selected } = props;

  const tree = React.useMemo(() => fileListToTree(items), [items]);

  const defaultExpandedSet = React.useMemo((): ReadonlySet<string> => {
    if (selected && items[selected]) {
      // Expand path to default file
      const expanded = new Set<string>();
      let path = "";
      for (const part of items[selected].path) {
        path += "/" + part;
        expanded.add(path);
      }
      return expanded;
    } else {
      // Expand all root archives
      return new Set(tree.children.map((n) => n.id));
    }
  }, [items, selected, tree]);
  const [expanded, setExpanded] = React.useState(defaultExpandedSet);

  const AnyAutoSizer = AutoSizer as any;
  return (
    <div className={styles.tree}>
      <AnyAutoSizer>
        {({ width, height }: { width: number, height: number; }) => (
          <Tree
            data={tree}
            width={width}
            height={height}
            indent={12}
            rowHeight={22}
            hideRoot
            isOpen={(node) => !node.id || expanded.has(node.id)}
            onToggle={(id, isCollapsed) => {
              const updated = new Set(expanded);
              isCollapsed ? updated.add(id) : updated.delete(id);
              setExpanded(updated);
            }}
          >
            {({ styles: css, data, handlers }) => (
              <div
                className={styles.item}
                style={css.row}
                role="row"
                aria-selected={!!selected && selected === data.index}
                onClick={(event) =>
                  data.index ? onSelect(data.index) : handlers.toggle(event)
                }
              >
                <div style={css.indent}>
                  {(() => {
                    if (data.item) {
                      return <FileCodeIcon />;
                    } else if (
                      data.name.endsWith(".zip") ||
                      data.name.endsWith(".tar.gz")
                    ) {
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
      </AnyAutoSizer>
    </div>
  );
}

export default FileTree;
