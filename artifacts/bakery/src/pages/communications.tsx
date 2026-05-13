import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Pin, PinOff, Trash2, Plus, Send,
  AlertCircle, CheckCircle2, Clock, RefreshCw,
  ChevronDown, ChevronUp, Lock,
} from "lucide-react";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return res.status === 204 ? null : res.json();
}

type Memo = {
  id: number; title: string; message: string;
  postedBy: string; postedAt: string;
  priority: "normal" | "urgent" | "holiday";
  isPinned: boolean; expiresAt: string | null;
};

type Feedback = {
  id: number; subject: string; message: string;
  submittedByName: string; submittedByRole: string; submittedAt: string;
  isAnonymous: boolean; status: "open" | "acknowledged" | "resolved";
  adminReply: string | null; repliedBy: string | null; repliedAt: string | null;
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PRIORITY = {
  normal:  { label: "Notice",  bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   ring: "ring-blue-400/30"   },
  urgent:  { label: "URGENT",  bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    ring: "ring-red-400/30"    },
  holiday: { label: "Holiday", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  ring: "ring-green-400/30"  },
};

const STATUS = {
  open:         { label: "Open",         bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
  acknowledged: { label: "Acknowledged", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200"   },
  resolved:     { label: "Resolved",     bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200"  },
};

// ─── Noticeboard ───────────────────────────────────────────────────────────────

function NoticeboardTab({ isAdmin, userName }: { isAdmin: boolean; userName: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", priority: "normal" as "normal" | "urgent" | "holiday" });

  const { data: memos = [], isLoading, refetch } = useQuery<Memo[]>({
    queryKey: ["memos"],
    queryFn: () => apiFetch("/memos"),
    staleTime: 30_000,
  });

  const createMemo = useMutation({
    mutationFn: (body: object) => apiFetch("/memos", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memos"] });
      setShowForm(false);
      setForm({ title: "", message: "", priority: "normal" });
      toast({ title: "Memo posted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMemo = useMutation({
    mutationFn: ({ id, isPinned }: { id: number; isPinned?: boolean; title?: string; message?: string; priority?: string }) =>
      apiFetch(`/memos/${id}`, { method: "PATCH", body: JSON.stringify({ isPinned }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memos"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMemo = useMutation({
    mutationFn: (id: number) => apiFetch(`/memos/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memos"] }); toast({ title: "Memo deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Post announcements, notices, and reminders for all staff." : "Announcements and notices from management."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" /> Post Memo
            </Button>
          )}
        </div>
      </div>

      {/* Post form (admin) */}
      {isAdmin && showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">New Memo</h3>
            <Input
              placeholder="Title / subject"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
              placeholder="Write your message here…"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">Priority:</span>
              {(["normal", "urgent", "holiday"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.priority === p
                      ? `${PRIORITY[p].bg} ${PRIORITY[p].text} ${PRIORITY[p].border} ring-2 ${PRIORITY[p].ring}`
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                  }`}
                >
                  {PRIORITY[p].label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!form.title.trim() || !form.message.trim() || createMemo.isPending}
                onClick={() => createMemo.mutate(form)}
              >
                Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memos list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : memos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No memos yet.{isAdmin ? " Post the first one above." : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map((m) => {
            const p = PRIORITY[m.priority] ?? PRIORITY.normal;
            return (
              <Card
                key={m.id}
                className={`border ${p.border} ${m.isPinned ? "ring-1 ring-primary/20" : ""}`}
              >
                <CardContent className={`p-4 ${p.bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {m.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${p.bg} ${p.text} ${p.border}`}>{p.label}</span>
                        <span className="text-xs text-muted-foreground">{fmt(m.postedAt)}</span>
                        <span className="text-xs text-muted-foreground">· by {m.postedBy}</span>
                      </div>
                      <h3 className={`font-semibold text-base mb-1 ${p.text}`}>{m.title}</h3>
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">{m.message}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          title={m.isPinned ? "Unpin" : "Pin to top"}
                          className="p-1.5 rounded hover:bg-black/5 text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => updateMemo.mutate({ id: m.id, isPinned: !m.isPinned })}
                        >
                          {m.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </button>
                        <button
                          title="Delete memo"
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          onClick={() => { if (confirm("Delete this memo?")) deleteMemo.mutate(m.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Feedback ──────────────────────────────────────────────────────────────────

function FeedbackTab({ isAdmin, userName, userRole }: { isAdmin: boolean; userName: string; userRole: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "", isAnonymous: false });
  const [replyBoxes, setReplyBoxes] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: feedbacks = [], isLoading, refetch } = useQuery<Feedback[]>({
    queryKey: ["feedback"],
    queryFn: () => apiFetch("/feedback"),
    staleTime: 30_000,
  });

  const submitFeedback = useMutation({
    mutationFn: (body: object) => apiFetch("/feedback", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      setShowForm(false);
      setForm({ subject: "", message: "", isAnonymous: false });
      toast({ title: "Feedback submitted", description: "Management will review it shortly." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateFeedback = useMutation({
    mutationFn: ({ id, adminReply, status }: { id: number; adminReply?: string; status?: string }) =>
      apiFetch(`/feedback/${id}`, { method: "PATCH", body: JSON.stringify({ adminReply, status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCount = feedbacks.filter((f) => f.status === "open").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? `${feedbacks.length} submission${feedbacks.length !== 1 ? "s" : ""}${openCount > 0 ? ` · ${openCount} open` : ""}`
              : "Share suggestions, questions, or concerns with management."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {!isAdmin && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" /> New Feedback
            </Button>
          )}
        </div>
      </div>

      {/* Submit form */}
      {!isAdmin && showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Submit Feedback to Management</h3>
            <Input
              placeholder="Subject / title"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
              placeholder="Describe your feedback, question, or concern…"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(e) => setForm((f) => ({ ...f, isAnonymous: e.target.checked }))}
                className="rounded"
              />
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Submit anonymously (management will not see your name)
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!form.subject.trim() || !form.message.trim() || submitFeedback.isPending}
                onClick={() => submitFeedback.mutate(form)}
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{isAdmin ? "No feedback submitted yet." : "You haven't submitted any feedback yet."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((f) => {
            const s = STATUS[f.status] ?? STATUS.open;
            const isExpanded = expanded[f.id];
            return (
              <Card key={f.id} className={`border ${s.border}`}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpanded((v) => ({ ...v, [f.id]: !v[f.id] }))}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
                        {f.status === "open" && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                        {f.status === "resolved" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        <span className="text-xs text-muted-foreground">{fmt(f.submittedAt)}</span>
                      </div>
                      <h3 className="font-semibold text-sm">{f.subject}</h3>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isAdmin
                          ? f.isAnonymous
                            ? "Anonymous"
                            : `${f.submittedByName} · ${f.submittedByRole}`
                          : "Your submission"}
                      </div>
                    </div>
                    <button className="text-muted-foreground shrink-0 p-1">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/30">{f.message}</p>

                      {/* Admin reply (visible to all) */}
                      {f.adminReply && (
                        <div className="border rounded-md p-3 bg-primary/5 border-primary/20">
                          <div className="text-xs font-semibold text-primary mb-1">
                            Management Reply{f.repliedBy ? ` · ${f.repliedBy}` : ""}
                            {f.repliedAt ? ` · ${fmt(f.repliedAt)}` : ""}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{f.adminReply}</p>
                        </div>
                      )}

                      {/* Admin actions */}
                      {isAdmin && (
                        <div className="space-y-3 pt-1">
                          {/* Status buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-muted-foreground">Status:</span>
                            {(["open", "acknowledged", "resolved"] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => updateFeedback.mutate({ id: f.id, status: st })}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                  f.status === st
                                    ? `${STATUS[st].bg} ${STATUS[st].text} ${STATUS[st].border} ring-1 ring-offset-0`
                                    : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                                }`}
                              >
                                {STATUS[st].label}
                              </button>
                            ))}
                          </div>

                          {/* Reply box */}
                          <div className="space-y-2">
                            <textarea
                              className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                              placeholder="Write a reply to this feedback…"
                              value={replyBoxes[f.id] ?? f.adminReply ?? ""}
                              onChange={(e) => setReplyBoxes((v) => ({ ...v, [f.id]: e.target.value }))}
                            />
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                disabled={!(replyBoxes[f.id] ?? "").trim() || updateFeedback.isPending}
                                onClick={() => {
                                  updateFeedback.mutate({ id: f.id, adminReply: replyBoxes[f.id], status: f.status === "open" ? "acknowledged" : f.status });
                                  toast({ title: "Reply sent" });
                                }}
                              >
                                <Send className="h-3.5 w-3.5 mr-1" /> Send Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submit button at bottom for non-admin (also show if form not open) */}
      {!isAdmin && !showForm && (
        <Button className="w-full" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Submit New Feedback
        </Button>
      )}
    </div>
  );
}

export default function CommunicationsPage() {
  const user = getUser();
  const isAdmin = user?.role === "admin";
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Staff noticeboard &amp; feedback channel</p>
      </div>
      <Tabs defaultValue="noticeboard">
        <TabsList className="w-full">
          <TabsTrigger value="noticeboard" className="flex-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Noticeboard
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex-1 flex items-center gap-2">
            <Send className="h-4 w-4" /> Feedback
          </TabsTrigger>
        </TabsList>
        <TabsContent value="noticeboard" className="mt-4">
          <NoticeboardTab isAdmin={isAdmin} userName={user?.name ?? ""} />
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          <FeedbackTab isAdmin={isAdmin} userName={user?.name ?? ""} userRole={user?.role ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
