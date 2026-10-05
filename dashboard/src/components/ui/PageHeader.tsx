import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Use "h1" only when the page has no other h1 (the dashboard shell already provides one). */
  as?: 'h1' | 'h2';
}

export default function PageHeader({ title, description, actions, as: Heading = 'h2' }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
