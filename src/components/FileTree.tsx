import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileZipIcon,
} from "@primer/octicons-react";
import React from "react";

import { archiveSuffixes } from "@src/common/util";
import type { DataFileKey } from "@src/database/types";

import styles from "@src/components/FileTree.module.css";

type Props = {
  items: ReadonlyArray<DataFileKey>;
  selected?: DataFileKey;
  onSelect: (slug?: string) => void;
};

const indent = 12;

type Tree = Map<string, DataFileKey | Tree>;

function treeify(items: ReadonlyArray<DataFileKey>): Tree {
  const root = new Map<string, DataFileKey | Tree>();
  for (const item of items) {
    let node = root;
    for (const part of item.path.slice(0, -1)) {
      let next = node.get(part);
      if (!next) {
        next = new Map<string, DataFileKey | Tree>();
        node.set(part, next);
      } else if (!(next instanceof Map)) {
        throw new Error("Invalid directory structure at " + part);
      }
      node = next;
    }
    const filename = item.path.at(-1) as string;
    if (node.has(filename)) {
      console.warn("Overwriting file at " + item.path);
    }
    node.set(filename, item);
  }
  return root;
}

type BranchProps = {
  node: Tree;
  path?: ReadonlyArray<string>;
  selected?: DataFileKey;
  onSelect: (slug?: string) => void;
};

const Branch = React.memo((props: BranchProps): React.JSX.Element | null => {
  const { node, path, selected, onSelect } = props;

  const branches = Array.from(node.entries()).filter(
    ([_, value]) => value instanceof Map,
  ) as [string, Tree][];
  branches.sort();

  const leaves = Array.from(node.entries()).filter(
    ([_, value]) => !(value instanceof Map),
  ) as unknown as [string, DataFileKey][];
  leaves.sort();

  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!path) return;
    if (selected && selected.path.join("/").startsWith(path.join("/")))
      setExpanded(true);
    if (!selected && path.length < 2) setExpanded(true);
  }, [path, selected]);

  const inner =
    !path || expanded ? (
      <React.Fragment>
        {branches.map(([name, value]) => (
          <Branch
            key={name}
            node={value}
            path={(path || []).concat([name])}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
        {leaves.map(([name, leaf]) => (
          <div
            key={name}
            className={styles.item}
            style={{ paddingLeft: (path?.length || 0) * indent }}
            role="row"
            aria-selected={selected?.slug === leaf.slug}
            onClick={() => onSelect(leaf.slug)}
          >
            <FileCodeIcon />
            {name}
          </div>
        ))}
      </React.Fragment>
    ) : null;

  const name = path?.at(-1);
  if (path && name) {
    return (
      <React.Fragment>
        <div
          className={styles.item}
          style={{ paddingLeft: (path.length - 1) * indent }}
          onClick={() => setExpanded((x) => !x)}
        >
          {archiveSuffixes.some((end) => name?.endsWith(end)) ? (
            <FileZipIcon />
          ) : expanded ? (
            <ChevronDownIcon />
          ) : (
            <ChevronRightIcon />
          )}
          {name}
        </div>
        {inner}
      </React.Fragment>
    );
  } else {
    return inner;
  }
});

function FileTree(props: Props): React.JSX.Element {
  const { items, onSelect, selected } = props;

  const tree = React.useMemo(() => treeify(items), [items]);
  return (
    <div className={styles.tree}>
      <Branch node={tree} selected={selected} onSelect={onSelect} />
    </div>
  );
}

export default FileTree;
