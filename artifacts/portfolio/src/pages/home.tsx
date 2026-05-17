import { motion, type Variants } from "framer-motion";
import { ArrowRight, Code2, Database, Cloud, Terminal, Mail, MapPin, Phone, Github, ExternalLink, ChevronRight, Briefcase, GraduationCap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
  };

  const stagger: Variants = {
    visible: { transition: { staggerChildren: 0.1 } }
  };

  const projects = [
    {
      featured: true,
      label: "Full-Stack Management System",
      title: "Marbith Bakery Management System",
      description:
        "A comprehensive full-stack operations platform for Marbith Bakery and Investments in Kampala. Powers the entire business workflow — POS sales, production tracking, inventory management, online orders with rider delivery dispatch, wholesale accounts, employee management, and automated MTN MoMo & Airtel Money payment recording.",
      tech: ["React 19", "Node.js", "PostgreSQL", "TypeScript", "TailwindCSS v4", "Drizzle ORM", "JWT Auth"],
      github: "https://github.com/ssalishadrach31/marbith-Bakery",
      live: null,
    },
    {
      featured: true,
      label: "Public Website",
      title: "Marbith Bakery — Customer Website",
      description:
        "The customer-facing public website for Marbith Bakery and Investments. Showcases the full product catalogue with real photos, an online ordering form, and contact details. Built for speed and accessibility, designed to convert visitors into customers.",
      tech: ["React", "Vite", "TailwindCSS", "TypeScript"],
      github: "https://github.com/ssalishadrach31/marbith-Bakery",
      live: null,
    },
    {
      featured: false,
      label: "HR Management System",
      title: "Saari Employee Management System",
      description:
        "A full-stack HR and employee management system built for Saari Oil Fields Services. Handles employee records, attendance tracking, role management, and HR workflows tailored to the oil-field services industry.",
      tech: ["React", "Node.js", "PostgreSQL", "TypeScript"],
      github: "https://github.com/ssalishadrach31/saari-employee-management-system",
      live: null,
    },
  ];

  const experience = [
    {
      role: "Civil & E&I Job Performer",
      company: "Abu Dhabi National Oil Company (ADNOC)",
      sub: "via Saari Oil Fields Services · ADNOC Approved",
      location: "Abu Dhabi, UAE",
      period: "Jan 2024 — Present",
      current: true,
    },
    {
      role: "Civil & E&I Job Performer",
      company: "Adyard Abu Dhabi LLC",
      sub: "ADNOC Approved",
      location: "Abu Dhabi, UAE",
      period: "Jul 2022 — Dec 2023",
      current: false,
    },
  ];

  const education = [
    {
      degree: "Bachelor of Computer Applications (BCA)",
      institution: "Jain University",
      detail: "Computer Applications · Information Technology · Computer Science",
    },
    {
      degree: "Uganda Certificate of Education (UCE) & Uganda Advanced Certificate of Education (UACE)",
      institution: "Kitebi Secondary School",
      detail: "Physics · Economics · Mathematics / ICT",
    },
  ];

  const skills = [
    {
      category: "Languages",
      items: ["C", "Python", "Java", "TypeScript", "JavaScript (ES6+)", "SQL"],
    },
    {
      category: "Frontend",
      items: ["React 19", "Vite", "TailwindCSS v4", "shadcn/ui", "Framer Motion", "React Query", "Mobile App Development"],
    },
    {
      category: "Backend & Systems",
      items: ["Node.js", "Express.js", "PostgreSQL", "REST APIs", "JWT Auth", "OpenAPI", "Web Applications"],
    },
    {
      category: "CS Fundamentals",
      items: ["Software Engineering", "Design Analysis & Algorithms", "Computer Networks", "Data Analysis & Visualization"],
    },
    {
      category: "DevOps & Tools",
      items: ["Git / GitHub", "Docker", "AWS", "CI/CD", "Linux", "Drizzle ORM"],
    },
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">

      {/* Noise Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">SSALI.</span>
          <div className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="#experience" className="hover:text-primary transition-colors">Experience</a>
            <a href="#work" className="hover:text-primary transition-colors">Work</a>
            <a href="#skills" className="hover:text-primary transition-colors">Skills</a>
            <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
          </div>
          <Button variant="default" className="rounded-none font-medium h-9 px-6 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <a href="#contact">Hire Me</a>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-5xl"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6 text-primary font-mono text-sm uppercase tracking-wider">
              <span className="w-8 h-px bg-primary" />
              Full Stack Developer · Data Analyst · Cloud Engineer
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-8xl font-display font-bold leading-[1.1] tracking-tight mb-8">
              I build production<br className="hidden md:block" />
              systems that <span className="text-muted-foreground">scale.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-6 leading-relaxed">
              Kampala, Uganda · Abu Dhabi, UAE. Full-stack engineer and ADNOC-approved professional building resilient web applications, data pipelines, and scalable cloud infrastructure for businesses that demand reliability.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <Button size="lg" className="rounded-none h-14 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                <a href="#work">View Projects <ArrowRight className="ml-2 h-5 w-5" /></a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-none h-14 px-8 text-base border-border hover:bg-secondary" asChild>
                <a href="https://github.com/ssalishadrach31" target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-5 w-5" /> GitHub
                </a>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Philosophy */}
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
              Software is only as good as its ability to survive contact with reality. Whether building management systems for East African businesses or working within ADNOC's industrial infrastructure, I architect solutions designed for the real world — handling actual users, messy data, and fluctuating loads without breaking a sweat.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Kampala, Uganda &amp; Abu Dhabi, UAE</div>
              <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
              <div className="text-muted-foreground">BCA, Jain University</div>
              <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
              <div className="text-muted-foreground">ADNOC Approved</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-32 px-6">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16 md:mb-24"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Core Disciplines</h2>
            <p className="text-muted-foreground max-w-xl text-lg">End-to-end technical expertise from concept to high-availability deployment.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
            {[
              {
                icon: <Code2 className="h-8 w-8 mb-6 text-primary" />,
                title: "Full Stack Web Development",
                description: "Architecting and building responsive, high-performance web applications using React, Node.js, PostgreSQL, and TypeScript. Clean code, maintainable structures, and production-tested patterns.",
              },
              {
                icon: <Database className="h-8 w-8 mb-6 text-primary" />,
                title: "Data Analysis & Visualization",
                description: "Transforming raw data into actionable business intelligence. Complex queries, data pipelines, and interactive dashboards that drive real decisions.",
              },
              {
                icon: <Cloud className="h-8 w-8 mb-6 text-primary" />,
                title: "Cloud Engineering & DevOps",
                description: "Designing resilient cloud infrastructure, CI/CD pipelines, and ensuring applications are highly available, secure, and scalable on modern cloud platforms.",
              },
              {
                icon: <Terminal className="h-8 w-8 mb-6 text-primary" />,
                title: "Custom Software Solutions",
                description: "Bespoke internal tools, CRMs, HR systems, and management platforms tailored to specific business operations — from East Africa to the Gulf.",
              },
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

      {/* Experience */}
      <section id="experience" className="py-32 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Experience</h2>
            <p className="text-muted-foreground max-w-xl text-lg">Industrial and software experience across East Africa and the Gulf.</p>
          </motion.div>

          <div className="space-y-0 border border-border">
            {experience.map((job, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className={`p-8 lg:p-12 flex flex-col md:flex-row md:items-start gap-6 ${i < experience.length - 1 ? "border-b border-border" : ""} bg-background`}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h3 className="text-xl font-display font-bold">{job.role}</h3>
                    {job.current && (
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-mono uppercase tracking-wider rounded-sm">Current</span>
                    )}
                  </div>
                  <p className="text-primary font-semibold mb-1">{job.company}</p>
                  {job.sub && <p className="text-muted-foreground text-sm mb-2">{job.sub}</p>}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                    <span>{job.period}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Education */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-16 mb-8"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Education</h2>
          </motion.div>

          <div className="space-y-0 border border-border">
            {education.map((edu, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className={`p-8 lg:p-12 flex flex-col md:flex-row md:items-start gap-6 ${i < education.length - 1 ? "border-b border-border" : ""} bg-background`}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-display font-bold mb-1">{edu.degree}</h3>
                  <p className="text-primary font-semibold mb-1">{edu.institution}</p>
                  <p className="text-muted-foreground text-sm">{edu.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="work" className="py-32 px-6">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Featured Work</h2>
            <p className="text-muted-foreground max-w-xl text-lg">Systems built and operating in production environments.</p>
          </motion.div>

          <div className="space-y-8">
            {projects.map((project, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.05 }}
                className="border border-border bg-background hover:border-primary/40 transition-colors group"
              >
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-4 text-primary font-mono text-xs uppercase tracking-wider">
                    <span className="w-6 h-px bg-primary" />
                    {project.label}
                  </div>
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1">
                      <h3 className="text-2xl md:text-3xl font-display font-bold mb-4 group-hover:text-primary transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed mb-6 max-w-2xl">{project.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {project.tech.map(t => (
                          <span key={t} className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-row lg:flex-col gap-3 flex-shrink-0">
                      {project.github && (
                        <Button variant="outline" className="rounded-none border-border hover:border-primary hover:bg-secondary" asChild>
                          <a href={project.github} target="_blank" rel="noreferrer">
                            <Github className="mr-2 h-4 w-4" /> Source Code
                          </a>
                        </Button>
                      )}
                      {project.live && (
                        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                          <a href={project.live} target="_blank" rel="noreferrer">
                            <Globe className="mr-2 h-4 w-4" /> Live Site
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Skills */}
      <section id="skills" className="py-32 px-6 bg-secondary/10">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Technical Arsenal</h2>
            <p className="text-muted-foreground max-w-xl text-lg">Languages, frameworks, and fundamentals across the full stack.</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-y-12 gap-x-8">
            {skills.map((col, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h4 className="font-mono text-sm text-primary mb-6 uppercase tracking-wider">{col.category}</h4>
                <ul className="space-y-3">
                  {col.items.map(skill => (
                    <li key={skill} className="text-foreground text-sm font-medium flex items-center gap-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      {skill}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
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
                <a href="mailto:ssalishadrach31@gmail.com" className="flex items-center gap-4 hover:opacity-70 transition-opacity group">
                  <Mail className="h-6 w-6 group-hover:-translate-y-1 transition-transform flex-shrink-0" />
                  ssalishadrach31@gmail.com
                </a>
                <a href="tel:+256751900731" className="flex items-center gap-4 hover:opacity-70 transition-opacity group">
                  <Phone className="h-6 w-6 group-hover:-translate-y-1 transition-transform flex-shrink-0" />
                  +256 751 900731
                </a>
                <div className="flex items-center gap-4">
                  <MapPin className="h-6 w-6 flex-shrink-0" />
                  Kampala, Uganda &amp; Abu Dhabi, UAE
                </div>
                <a href="https://github.com/ssalishadrach31" target="_blank" rel="noreferrer" className="flex items-center gap-4 hover:opacity-70 transition-opacity group">
                  <Github className="h-6 w-6 group-hover:-translate-y-1 transition-transform flex-shrink-0" />
                  github.com/ssalishadrach31
                </a>
              </div>

              <div className="space-y-6">
                <div className="border-t border-primary-foreground/30 pt-6">
                  <p className="text-sm font-mono opacity-80 uppercase tracking-wider mb-3">University Education</p>
                  <p className="font-semibold">Bachelor of Computer Applications (BCA)</p>
                  <p className="text-primary-foreground/70">Jain University</p>
                </div>
                <div className="border-t border-primary-foreground/30 pt-6">
                  <p className="text-sm font-mono opacity-80 uppercase tracking-wider mb-3">Secondary Education</p>
                  <p className="font-semibold">UCE &amp; UACE — Kitebi Secondary School</p>
                  <p className="text-primary-foreground/70">Physics · Economics · Mathematics / ICT</p>
                </div>
                <div className="border-t border-primary-foreground/30 pt-6">
                  <p className="text-sm font-mono opacity-80 uppercase tracking-wider mb-3">Current Employer</p>
                  <p className="font-semibold">ADNOC — Abu Dhabi National Oil Company</p>
                  <p className="text-primary-foreground/70">via Saari Oil Fields Services · ADNOC Approved</p>
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
