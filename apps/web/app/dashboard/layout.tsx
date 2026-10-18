import SideNav from "@/components/SideNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <SideNav />
      <main className="content">{children}</main>
    </div>
  );
}
