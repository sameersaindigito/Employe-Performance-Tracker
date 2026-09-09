import { PageShell } from '../components/layout/PageShell';
import { PortfolioGrid } from '../components/portfolio/PortfolioGrid';

export function Portfolio() {
  return (
    <PageShell
      title="Portfolio"
      subtitle="Browse all designer work by platform"
    >
      <PortfolioGrid />
    </PageShell>
  );
}
