import React, { MouseEventHandler } from "react";

export type Location = {
  pathname: string;
  state?: unknown;
  _set: (location: Location) => void;
};

export const LocationContext = React.createContext<Location | void>(undefined);

export function useNavigate(): (
  to: string,
  opts?: { replace?: boolean; state?: unknown },
) => void {
  const location = React.useContext(LocationContext);
  return (to, opts) => {
    if (!location) throw new Error("LocationContext not found");

    location._set({ pathname: to, state: opts?.state, _set: location._set });
    opts?.replace
      ? window.history.replaceState(opts?.state, "", to)
      : window.history.pushState(opts?.state, "", to);
  };
}

export function Link(
  props: {
    children: React.ReactNode;
    replace?: boolean;
    state?: unknown;
    to: string;
  } & React.ComponentPropsWithRef<"a">,
): JSX.Element {
  const navigate = useNavigate();
  const { children, replace, state, to, ...rest } = props;
  const onClick: MouseEventHandler = (e) => {
    if (e.ctrlKey) return;
    e.preventDefault();
    navigate(to, { replace, state });
  };
  return (
    <a {...rest} href={to} onClick={onClick}>
      {children}
    </a>
  );
}

export function Navigate(props: {
  to: string;
  replace?: boolean;
  state?: unknown;
}): JSX.Element {
  const navigate = useNavigate();
  const { to, ...opts } = props;
  React.useEffect(() => navigate(to, opts));
  return <React.Fragment></React.Fragment>;
}
