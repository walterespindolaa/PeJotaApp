import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AdminRoute;
