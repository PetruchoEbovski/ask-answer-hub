import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Building, MessageSquare, Shield, Plus, Trash2, Search, Filter, Clock, TrendingUp, CheckCircle, UserCog } from "lucide-react";
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
import { UserManagement } from "@/components/admin/UserManagement";

interface DepartmentAdmin {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  department_id: string;
  department_name: string;
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

type SortOption = 'newest' | 'trending' | 'answered';

export default function Admin() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Department Admins state
  const [departmentAdmins, setDepartmentAdmins] = useState<DepartmentAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminDepartment, setNewAdminDepartment] = useState("");
  
  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  
  // Questions state
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionDeptFilter, setQuestionDeptFilter] = useState<string>("all");
  const [questionSort, setQuestionSort] = useState<SortOption>("newest");
  
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, isLoading, navigate]);

  const fetchDepartmentAdmins = async () => {
    // Fetch department_admins with profile info
    const { data: adminsData } = await supabase
      .from('department_admins')
      .select('id, user_id, department_id');

    if (!adminsData || adminsData.length === 0) {
      setDepartmentAdmins([]);
      return;
    }

    // Get unique user IDs and department IDs
    const userIds = [...new Set(adminsData.map(a => a.user_id))];
    const deptIds = [...new Set(adminsData.map(a => a.department_id))];

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    // Fetch departments
    const { data: depts } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', deptIds);

    const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const deptsMap = new Map(depts?.map(d => [d.id, d.name]) || []);

    const formattedAdmins: DepartmentAdmin[] = adminsData.map(a => ({
      id: a.id,
      user_id: a.user_id,
      email: profilesMap.get(a.user_id)?.email || 'Unknown',
      full_name: profilesMap.get(a.user_id)?.full_name || null,
      department_id: a.department_id,
      department_name: deptsMap.get(a.department_id) || 'Unknown',
    }));

    setDepartmentAdmins(formattedAdmins);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    if (data) setDepartments(data);
  };

  const fetchQuestions = async () => {
    let query = supabase
      .from('questions')
      .select(`
        id,
        title,
        status,
        upvotes,
        created_at,
        department:departments(name),
        answers(id)
      `);

    if (questionDeptFilter !== "all") {
      query = query.eq('department_id', questionDeptFilter);
    }

    if (questionSort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (questionSort === 'trending') {
      query = query.order('upvotes', { ascending: false });
    } else if (questionSort === 'answered') {
      query = query.eq('status', 'answered').order('created_at', { ascending: false });
    }

    const { data } = await query.limit(100);

    if (data) {
      setQuestions(data.map(q => ({
        ...q,
        answers_count: q.answers?.length || 0,
      })));
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      Promise.all([fetchDepartmentAdmins(), fetchDepartments(), fetchQuestions()])
        .finally(() => setIsLoadingData(false));
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchQuestions();
    }
  }, [questionDeptFilter, questionSort]);

  const handleAddDepartmentAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminDepartment) {
      toast({ title: "Please enter email and select department", variant: "destructive" });
      return;
    }

    // Find user by email
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', newAdminEmail.trim().toLowerCase())
      .maybeSingle();

    if (profileError || !profileData) {
      toast({ title: "User not found", description: "Make sure the user has signed up first", variant: "destructive" });
      return;
    }

    // Add to department_admins
    const { error: insertError } = await supabase
      .from('department_admins')
      .insert({ user_id: profileData.user_id, department_id: newAdminDepartment });

    if (insertError) {
      if (insertError.code === '23505') {
        toast({ title: "User already assigned to this department", variant: "destructive" });
      } else {
        toast({ title: "Failed to add admin", variant: "destructive" });
      }
      return;
    }

    // Ensure user has responder role
    await supabase
      .from('user_roles')
      .upsert({ user_id: profileData.user_id, role: 'responder' as any }, { onConflict: 'user_id,role' });

    toast({ title: "Admin added successfully" });
    setNewAdminEmail("");
    setNewAdminDepartment("");
    fetchDepartmentAdmins();
  };

  const handleRemoveDepartmentAdmin = async (id: string) => {
    const { error } = await supabase
      .from('department_admins')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to remove admin", variant: "destructive" });
    } else {
      toast({ title: "Admin removed" });
      fetchDepartmentAdmins();
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

  const filteredQuestions = questions.filter(q =>
    q.title.toLowerCase().includes(questionSearch.toLowerCase())
  );

  // Group department admins by department
  const adminsByDepartment = departmentAdmins.reduce((acc, admin) => {
    if (!acc[admin.department_name]) {
      acc[admin.department_name] = [];
    }
    acc[admin.department_name].push(admin);
    return acc;
  }, {} as Record<string, DepartmentAdmin[]>);

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
          onClick={() => navigate("/questions")}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Questions
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage department admins, departments, and questions
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl h-12 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger 
              value="users" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all"
            >
              <UserCog className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="admins" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all"
            >
              <Users className="w-4 h-4" />
              Dept Admins
            </TabsTrigger>
            <TabsTrigger 
              value="departments" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all"
            >
              <Building className="w-4 h-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger 
              value="questions" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              Questions
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          {/* Department Admins Tab */}
          <TabsContent value="admins">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Department Admins
                </CardTitle>
                <CardDescription>
                  Assign admins to manage and answer questions for specific departments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Admin Form */}
                <div className="flex flex-col sm:flex-row gap-3 p-4 bg-secondary/30 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="admin-email" className="sr-only">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@getblock.io"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="admin-dept" className="sr-only">Department</Label>
                    <Select value={newAdminDepartment} onValueChange={setNewAdminDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddDepartmentAdmin} disabled={!newAdminEmail.trim() || !newAdminDepartment}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Admin
                  </Button>
                </div>

                {/* Admins List by Department */}
                {Object.keys(adminsByDepartment).length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No department admins assigned yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(adminsByDepartment).map(([deptName, admins]) => (
                      <div key={deptName} className="border rounded-lg">
                        <div className="px-4 py-3 bg-muted/50 border-b">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            {deptName}
                            <Badge variant="secondary" className="ml-auto">
                              {admins.length} admin{admins.length !== 1 ? 's' : ''}
                            </Badge>
                          </h3>
                        </div>
                        <div className="divide-y">
                          {admins.map(admin => (
                            <div key={admin.id} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium">{admin.full_name || 'No name'}</p>
                                <p className="text-sm text-muted-foreground">{admin.email}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveDepartmentAdmin(admin.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  Manage department categories for questions
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
                  View and manage all questions from the team
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search questions..."
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={questionDeptFilter} onValueChange={setQuestionDeptFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    <Button
                      variant={questionSort === 'newest' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setQuestionSort('newest')}
                      className="gap-1.5"
                    >
                      <Clock className="w-4 h-4" />
                      Newest
                    </Button>
                    <Button
                      variant={questionSort === 'trending' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setQuestionSort('trending')}
                      className="gap-1.5"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Trending
                    </Button>
                    <Button
                      variant={questionSort === 'answered' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setQuestionSort('answered')}
                      className="gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Answered
                    </Button>
                  </div>
                </div>

                {/* Questions Table */}
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
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No questions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.map((q) => (
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
                      ))
                    )}
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
