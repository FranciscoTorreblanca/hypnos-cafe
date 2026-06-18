import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOpenSession } from "@/hooks/useAttendance";

const BYPASS_PATHS = ["/check-in", "/time-clock"];

export const AttendanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isSuperAdmin, hasFeature, loading } = useAuth();
  const location = useLocation();
  const enabled = hasFeature("time_attendance" as any);
  const { loading: sessLoading, hasOpen } = useOpenSession(enabled && user ? user.id : null);

  if (loading) return null;
  if (!enabled) return <>{children}</>;
  if (isAdmin || isSuperAdmin) return <>{children}</>;
  if (BYPASS_PATHS.some((p) => location.pathname.startsWith(p))) return <>{children}</>;
  if (sessLoading) return null;
  if (!hasOpen) return <Navigate to="/check-in" replace />;
  return <>{children}</>;
};
