import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { ArrowRight, Code2, Database, Cloud, Terminal, Mail, MapPin, Phone, Github, ExternalLink, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRef } from "react";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
  };

  const stagger: Variants = {
    visible: { transition: { staggerChildren: 0.1 } }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      
      {/* Abstract Noise Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">SSALI.</span>
          <div className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="#services" className="hover:text-primary transition-colors">Services</a>
            <a href="#work" className="hover:text-primary transition-colors">Work</a>
            <a href="#skills" className="hover:text-primary transition-colors">Skills</a>
            <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
          </div>
          <Button variant="default" className="rounded-none font-medium h-9 px-6 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <a href="#contact">Hire Me</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-4xl"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6 text-primary font-mono text-sm uppercase tracking-wider">
              <span className="w-8 h-px bg-primary"></span>
              Full Stack Developer · Data Analyst · Cloud Engineer
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-[1.1] tracking-tight mb-8">
              I build production <br className="hidden md:block"/>
              systems that <span className="text-muted-foreground">scale.</span>
            </motion.h1>
            
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
              Based in Kampala, Uganda. I engineer resilient web applications, complex data pipelines, and scalable cloud infrastructure for businesses that demand reliability.
            </motion.p>
            
            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <Button size="lg" className="rounded-none h-14 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                <a href="#work">View Projects <ArrowRight className="ml-2 h-5 w-5" /></a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-none h-14 px-8 text-base border-border hover:bg-secondary" asChild>
                <a href="https://github.com/ssalishadrach31" target="_blank" rel="noreferrer"><Github className="mr-2 h-5 w-5" /> GitHub</a>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 bg-secondary/30 border-y border-border px-6">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            className="max-w-3xl"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Precise. Grounded. Production-ready.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              Software is only as good as its ability to survive contact with reality. I don't just write code; I architect solutions designed for the real world—handling actual users, messy data, and fluctuating loads without breaking a sweat.
            </p>
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Kampala, Uganda</div>
              <div className="w-1 h-1 rounded-full bg-border"></div>
              <div className="text-muted-foreground">BCA, Jain University</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-6">
        <div className="container mx-auto">
          <div className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Core Disciplines</h2>
              <p className="text-muted-foreground max-w-xl text-lg">End-to-end technical expertise to take your vision from concept to high-availability deployment.</p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
            {[
              {
                icon: <Code2 className="h-8 w-8 mb-6 text-primary" />,
                title: "Full Stack Web Development",
                description: "Architecting and building responsive, high-performance web applications using React, Node.js, PostgreSQL, and TypeScript. Focus on clean code, solid testing, and maintainable structures."
              },
              {
                icon: <Database className="h-8 w-8 mb-6 text-primary" />,
                title: "Data Analysis & Visualization",
                description: "Transforming raw data into actionable business intelligence. Building complex queries, data pipelines, and interactive dashboards that drive decision-making."
              },
              {
                icon: <Cloud className="h-8 w-8 mb-6 text-primary" />,
                title: "Cloud Engineering & DevOps",
                description: "Designing resilient cloud infrastructure, setting up CI/CD pipelines, and ensuring applications are highly available, secure, and scalable on modern cloud platforms."
              },
              {
                icon: <Terminal className="h-8 w-8 mb-6 text-primary" />,
                title: "Custom Software Solutions",
                description: "Developing bespoke internal tools, CRMs, and management systems tailored to specific business operations and workflows in East Africa and beyond."
              }
            ].map((service, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-background p-10 lg:p-16 group hover:bg-secondary/20 transition-colors"
              >
                {service.icon}
                <h3 className="text-2xl font-display font-bold mb-4">{service.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Project */}
      <section id="work" className="py-32 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Featured Work</h2>
            <p className="text-muted-foreground max-w-xl text-lg">Systems operating in production environments.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-border bg-background shadow-2xl shadow-black/50"
          >
            <div className="lg:col-span-5 p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6 text-primary font-mono text-xs uppercase tracking-wider">
                <span className="w-8 h-px bg-primary"></span>
                Production System
              </div>
              <h3 className="text-3xl font-display font-bold mb-6">Marbith Bakery Management System</h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                A comprehensive full-stack operations platform for Marbith Bakery and Investments in Kampala. It powers their entire workflow—from production tracking and inventory management to POS sales, online orders with delivery dispatch, and automated mobile money payment recording.
              </p>
              <div className="flex flex-wrap gap-2 mb-10">
                {["React 19", "Node.js", "PostgreSQL", "TypeScript", "TailwindCSS v4", "Drizzle ORM"].map(tech => (
                  <span key={tech} className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-medium">{tech}</span>
                ))}
              </div>
              <Button className="rounded-none self-start bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <a href="https://github.com/ssalishadrach31/marbith-Bakery" target="_blank" rel="noreferrer">
                  View Source Code <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="lg:col-span-7 bg-secondary/30 relative min-h-[300px] lg:min-h-[500px] overflow-hidden flex items-center justify-center p-8">
               {/* Abstract placeholder for project image/ui */}
               <div className="w-full max-w-lg aspect-video bg-background border border-border shadow-xl rounded-sm flex flex-col overflow-hidden">
                 <div className="h-8 border-b border-border bg-secondary/50 flex items-center px-4 gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-border/80"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-border/80"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-border/80"></div>
                 </div>
                 <div className="flex-1 p-6 flex flex-col gap-4">
                   <div className="w-1/3 h-6 bg-secondary rounded-sm"></div>
                   <div className="w-full h-32 bg-secondary/50 rounded-sm"></div>
                   <div className="flex gap-4">
                     <div className="flex-1 h-20 bg-secondary/50 rounded-sm"></div>
                     <div className="flex-1 h-20 bg-secondary/50 rounded-sm"></div>
                     <div className="flex-1 h-20 bg-secondary/50 rounded-sm"></div>
                   </div>
                 </div>
               </div>
            </div>
          </motion.div>
          
          {/* Other projects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 border border-border bg-background hover:border-primary/50 transition-colors group"
            >
              <h3 className="text-xl font-display font-bold mb-3 group-hover:text-primary transition-colors">East African Logistics Analytics</h3>
              <p className="text-muted-foreground text-sm mb-6">A data dashboard visualizing real-time fleet metrics and supply chain bottlenecks across regional borders.</p>
              <div className="flex flex-wrap gap-2">
                {["Python", "Pandas", "React", "AWS"].map(tech => (
                  <span key={tech} className="px-2 py-1 bg-secondary text-xs font-medium">{tech}</span>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-8 border border-border bg-background hover:border-primary/50 transition-colors group"
            >
              <h3 className="text-xl font-display font-bold mb-3 group-hover:text-primary transition-colors">Payment Gateway Infrastructure</h3>
              <p className="text-muted-foreground text-sm mb-6">Scalable microservices architecture designed to handle high-throughput mobile money transactions securely.</p>
              <div className="flex flex-wrap gap-2">
                {["Docker", "Kubernetes", "Node.js", "Redis"].map(tech => (
                  <span key={tech} className="px-2 py-1 bg-secondary text-xs font-medium">{tech}</span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Skills Grid */}
      <section id="skills" className="py-32 px-6">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Technical Arsenal</h2>
          </motion.div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8">
            {[
              { category: "Languages", skills: ["TypeScript", "JavaScript (ES6+)", "Python", "SQL", "HTML/CSS"] },
              { category: "Frontend", skills: ["React 19", "Vite", "TailwindCSS v4", "shadcn/ui", "Framer Motion", "React Query"] },
              { category: "Backend", skills: ["Node.js", "Express.js", "PostgreSQL", "REST APIs", "JWT Auth", "OpenAPI"] },
              { category: "DevOps & Tools", skills: ["Git / GitHub", "Docker", "AWS", "CI/CD", "Linux", "Drizzle ORM"] }
            ].map((col, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h4 className="font-mono text-sm text-primary mb-6 uppercase tracking-wider">{col.category}</h4>
                <ul className="space-y-4">
                  {col.skills.map(skill => (
                    <li key={skill} className="text-foreground font-medium flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      {skill}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="max-w-4xl">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl md:text-7xl font-display font-bold mb-10"
            >
              Let's build something robust.
            </motion.h2>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-12"
            >
              <div className="space-y-8 text-lg font-medium">
                <a href="mailto:ssalishadrach31@gmail.com" className="flex items-center gap-4 hover:text-black transition-colors group">
                  <Mail className="h-6 w-6 group-hover:-translate-y-1 transition-transform" /> 
                  ssalishadrach31@gmail.com
                </a>
                <a href="tel:+256751900731" className="flex items-center gap-4 hover:text-black transition-colors group">
                  <Phone className="h-6 w-6 group-hover:-translate-y-1 transition-transform" /> 
                  +256 751 900731
                </a>
                <div className="flex items-center gap-4">
                  <MapPin className="h-6 w-6" /> 
                  Kampala, Uganda
                </div>
              </div>
              
              <div className="space-y-8 text-lg font-medium">
                <a href="https://github.com/ssalishadrach31" target="_blank" rel="noreferrer" className="flex items-center gap-4 hover:text-black transition-colors group">
                  <Github className="h-6 w-6 group-hover:-translate-y-1 transition-transform" /> 
                  github.com/ssalishadrach31
                </a>
                <div className="flex flex-col gap-2 border-t border-primary-foreground/30 pt-6 mt-6">
                  <span className="text-sm font-mono opacity-80 uppercase tracking-wider">Education</span>
                  <span>BCA, Jain University</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-background border-t border-border text-center text-sm text-muted-foreground">
        <div className="container mx-auto">
          &copy; {new Date().getFullYear()} Shadrach Ssali. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
