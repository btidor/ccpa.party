// @flow
import * as React from "react";

import { getLiteColor } from "provider";

import type { Provider } from "provider";

type Props = {|
  +provider: Provider,
  +children: React.Node,
|};

function Theme(props: Props): React.Node {
  return (
    <div
      style={{
        "--primary": props.provider.color,
        "--primary-lite": getLiteColor(props.provider.color),
      }}
    >
      {props.children}
    </div>
  );
}

export default Theme;
