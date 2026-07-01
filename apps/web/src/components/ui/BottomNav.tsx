import { BarChart3, ListChecks, Star, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Dash", icon: BarChart3 },
  { to: "/flips", label: "Flips", icon: ListChecks },
  { to: "/watchlist", label: "Watch", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to}>
          <link.icon size={20} />
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
