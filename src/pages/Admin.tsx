import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Building, MessageSquare, Shield, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface UserWithRoles {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface QuestionAdmin {
  id: string;
  title: string;
  status: string;
  created_at: string;
  department: { name: string } | null;
  answers_count: number;
}

export default function Admin() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, isLoading, navigate]);

  const fetchUsers = async () => {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, user_id, email, full_name, created_at')
      .order('created_at', { ascending: false });

    if (profilesData) {
      const usersWithRoles = await Promise.all(
        profilesData.map(async (p) => {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', p.user_id);

          return {
            ...p,
            roles: rolesData?.map(r => r.role) || [],
          };
        })
      );
      setUsers(usersWithRoles);
    }
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    if (data) setDepartments(data);
  };

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from('questions')
      .select(`
        id,
        title,
        status,
        created_at,
        department:departments(name),
        answers(id)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setQuestions(data.map(q => ({
        ...q,
        answers_count: q.answers?.length || 0,
      })));
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      Promise.all([fetchUsers(), fetchDepartments(), fetchQuestions()])
        .finally(() => setIsLoadingData(false));
    }
  }, [user, isAdmin]);

  const handleAddRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: role as any });

    if (error) {
      if (error.code === '23505') {
        toast({ title: "User already has this role", variant: "destructive" });
      } else {
        toast({ title: "Failed to add role", variant: "destructive" });
      }
    } else {
      toast({ title: "Role added successfully" });
      fetchUsers();
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    if (role === 'employee') {
      toast({ title: "Cannot remove employee role", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast({ title: "Failed to remove role", variant: "destructive" });
    } else {
      toast({ title: "Role removed successfully" });
      fetchUsers();
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;

    const { error } = await supabase
      .from('departments')
      .insert({ name: newDeptName.trim(), description: newDeptDesc.trim() || null });

    if (error) {
      if (error.code === '23505') {
        toast({ title: "Department already exists", variant: "destructive" });
      } else {
        toast({ title: "Failed to add department", variant: "destructive" });
      }
    } else {
      toast({ title: "Department added successfully" });
      setNewDeptName("");
      setNewDeptDesc("");
      fetchDepartments();
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to delete department", variant: "destructive" });
    } else {
      toast({ title: "Department deleted" });
      fetchDepartments();
    }
  };

  const handleUpdateQuestionStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('questions')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
    } else {
      toast({ title: "Status updated" });
      fetchQuestions();
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to delete question", variant: "destructive" });
    } else {
      toast({ title: "Question deleted" });
      fetchQuestions();
    }
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={profile ? { email: profile.email, full_name: profile.full_name || undefined, avatar_url: profile.avatar_url || undefined } : null} 
        isAdmin={isAdmin} 
      />

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Questions
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage users, departments, and questions
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Building className="w-4 h-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Questions
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  User Roles
                </CardTitle>
                <CardDescription>
                  Manage who can respond to questions. Admins and Responders can post official answers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.full_name || "No name"}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((role) => (
                              <Badge
                                key={role}
                                variant={role === 'admin' ? 'default' : role === 'responder' ? 'secondary' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => handleRemoveRole(u.user_id, role)}
                              >
                                {role}
                                {role !== 'employee' && <span className="ml-1">×</span>}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Select onValueChange={(role) => handleAddRole(u.user_id, role)}>
                            <SelectTrigger className="w-[150px]">
                              <SelectValue placeholder="Add role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="responder">Responder</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Departments
                </CardTitle>
                <CardDescription>
                  Manage departments that questions can be addressed to.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="dept-name" className="sr-only">Department Name</Label>
                    <Input
                      id="dept-name"
                      placeholder="Department name"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="dept-desc" className="sr-only">Description</Label>
                    <Input
                      id="dept-desc"
                      placeholder="Description (optional)"
                      value={newDeptDesc}
                      onChange={(e) => setNewDeptDesc(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddDepartment} disabled={!newDeptName.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDepartment(d.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Questions
                </CardTitle>
                <CardDescription>
                  Manage and moderate questions from the team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Answers</TableHead>
                      <TableHead>Posted</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/question/${q.id}`)}
                            className="text-left font-medium hover:text-accent transition-colors line-clamp-1"
                          >
                            {q.title}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {q.department?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={q.status}
                            onValueChange={(status) => handleUpdateQuestionStatus(q.id, status)}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="answered">Answered</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {q.answers_count}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
