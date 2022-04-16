// @flow
import * as React from "react";
import { Tree } from "react-arborist";
import { AutoSizer } from "react-virtualized";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileZipIcon,
} from "@primer/octicons-react";

import styles from "components/FileTree.module.css";

import type { DataFileKey } from "database";

type Props = {|
  +children: $ReadOnlyArray<DataFileKey>,
  +selected: ?number, // index into children
  +onSelect: (number) => void,
|};

type TreeNode = {|
  id: string,
  name: string,
  children: Array<TreeNode>,
  _childmap: Map<string, TreeNode>,
  item?: DataFileKey,
  index?: string,
|};

function fileListToTree(items: $ReadOnlyArray<DataFileKey>): TreeNode {
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
}

function FileTree(props: Props): React.Node {
  const { children, onSelect, selected } = props;

  const tree = React.useMemo(() => fileListToTree(children), [children]);

  const defaultExpandedSet = React.useMemo((): $ReadOnlySet<string> => {
    if (selected && children[selected]) {
      // Expand path to default file
      const expanded = new Set();
      let path = "";
      for (const part of children[selected].path) {
        path += "/" + part;
        expanded.add(path);
      }
      return expanded;
    } else {
      // Expand all root archives
      return new Set(tree.children.map((n) => n.id));
    }
  }, [children, selected, tree]);
  const [expanded, setExpanded] = React.useState(defaultExpandedSet);

  return (
    <div className={styles.tree}>
      <AutoSizer>
        {({ width, height }) => (
          <Tree
            data={tree}
            width={width}
            height={height}
            indent={12}
            rowHeight={21}
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
                aria-selected={selected && selected === data.index}
                onClick={(event) =>
                  data.item ? onSelect(data.index) : handlers.toggle(event)
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
      </AutoSizer>
    </div>
  );
}

export default FileTree;
