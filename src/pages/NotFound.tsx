import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Backdrop from "@/components/Backdrop";

const NotFound = () => {
  useEffect(() => {
    document.title = "Not found — Jeeva G";
  }, []);

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center px-5 text-center">
      <Backdrop showCore={false} />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent-bright">404 · Route not found</p>
        <h1 className="mt-5 text-[clamp(2.4rem,6vw,4rem)] font-semibold tracking-[-0.04em] text-ink">This node isn&rsquo;t connected.</h1>
        <p className="mt-4 text-muted">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
        <Link
          to="/"
          className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line-strong px-5 text-[14px] text-ink transition-colors hover:border-accent/60"
        >
          <ArrowLeft size={16} /> Back to the system
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
