import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdminDashboardHome from "@/components/admin/AdminDashboardHome";

const Admin = () => {
  const location = useLocation();
  const isRoot = location.pathname === "/dashboard/admin";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Painel Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestão completa da plataforma.</p>
      </div>

      {isRoot ? (
        <AdminDashboardHome />
      ) : (
        <>
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <Outlet />
        </>
      )}
    </div>
  );
};

export default Admin;
