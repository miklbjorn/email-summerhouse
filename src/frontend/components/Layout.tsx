import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div className="layout">
      <h1>Invoice Dashboard</h1>
      {children}
    </div>
  );
}
