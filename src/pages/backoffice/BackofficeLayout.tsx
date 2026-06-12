import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/backoffice/businesses", label: "Businesses", icon: Building2 },
  { to: "/backoffice/super-admins", label: "Super Admins", icon: ShieldCheck },
];

const BackofficeLayout = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Button>
            <span className="text-sm font-semibold tracking-tight">Backoffice</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>Log out</Button>
          </div>
        </div>
        <nav className="flex gap-1 px-6 pb-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default BackofficeLayout;
