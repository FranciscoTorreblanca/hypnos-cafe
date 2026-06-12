import { Navigate } from "react-router-dom";
import { useAuth, type FeatureKey } from "@/hooks/useAuth";

export const FeatureGate: React.FC<{ feature: FeatureKey; children: React.ReactNode }> = ({ feature, children }) => {
  const { loading, hasFeature } = useAuth();
  if (loading) return null;
  if (!hasFeature(feature)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
