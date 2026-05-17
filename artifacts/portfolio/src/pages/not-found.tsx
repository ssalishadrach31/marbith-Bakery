import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 selection:bg-primary selection:text-primary-foreground">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center relative z-10"
      >
        <h1 className="text-8xl md:text-9xl font-display font-bold text-primary mb-6">404</h1>
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8">
          The route you are looking for doesn't exist or has been moved.
        </p>
        <Button asChild size="lg" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Return Home
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
