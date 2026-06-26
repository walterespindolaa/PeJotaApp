import { ReactNode } from "react";
import FeatureGate from "@/components/FeatureGate";
import { FEATURE_GATE_CONFIGS } from "@/lib/featureGateConfigs";

interface PageFeatureGateProps {
  configKey: string;
  children: ReactNode;
}

/**
 * Wraps any page component with the soft paywall.
 * Usage: <PageFeatureGate configKey="investimentos"><Investimentos /></PageFeatureGate>
 */
const PageFeatureGate = ({ configKey, children }: PageFeatureGateProps) => {
  const config = FEATURE_GATE_CONFIGS[configKey];
  if (!config) return <>{children}</>;

  return (
    <FeatureGate
      featureKey={config.featureKey}
      moduleName={config.moduleName}
      moduleDescription={config.moduleDescription}
      benefits={config.benefits}
    >
      {children}
    </FeatureGate>
  );
};

export default PageFeatureGate;
