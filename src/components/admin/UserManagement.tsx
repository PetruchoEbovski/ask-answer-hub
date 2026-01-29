import { useState, useEffect } from "react";
import { Users, Shield, ShieldCheck, ShieldX, Search, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setIsLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Create a map of user_id to roles
    const rolesMap = new Map<string, string[]>();
    roles?.forEach(r => {
      const existing = rolesMap.get(r.user_id) || [];
      existing.push(r.role);
      rolesMap.set(r.user_id, existing);
    });

    // Combine profiles with roles
    const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
      user_id: p.user_id,
      email: p.email,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      roles: rolesMap.get(p.user_id) || ['employee'],
    }));

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleAdmin = async (userId: string, currentRoles: string[]) => {
    const isCurrentlyAdmin = currentRoles.includes('admin');

    if (isCurrentlyAdmin) {
      // Remove admin role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) {
        toast({ title: "Failed to remove admin role", variant: "destructive" });
        return;
      }
      toast({ title: "Admin role removed" });
    } else {
      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' as any });

      if (error) {
        if (error.code === '23505') {
          toast({ title: "User already has admin role", variant: "destructive" });
        } else {
          toast({ title: "Failed to add admin role", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Admin role added" });
    }

    fetchUsers();
  };

  const handleToggleResponder = async (userId: string, currentRoles: string[]) => {
    const isCurrentlyResponder = currentRoles.includes('responder');

    if (isCurrentlyResponder) {
      // Remove responder role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'responder');

      if (error) {
        toast({ title: "Failed to remove responder role", variant: "destructive" });
        return;
      }
      toast({ title: "Responder role removed" });
    } else {
      // Add responder role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'responder' as any });

      if (error) {
        if (error.code === '23505') {
          toast({ title: "User already has responder role", variant: "destructive" });
        } else {
          toast({ title: "Failed to add responder role", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Responder role added" });
    }

    fetchUsers();
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.user_id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ title: "User deleted successfully" });
      fetchUsers();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({ 
        title: "Failed to delete user", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          User Management
        </CardTitle>
        <CardDescription>
          View all registered users and manage their roles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.includes('admin') && (
                          <Badge variant="default" className="bg-primary">Admin</Badge>
                        )}
                        {user.roles.includes('responder') && (
                          <Badge variant="secondary">Responder</Badge>
                        )}
                        {user.roles.includes('employee') && !user.roles.includes('admin') && !user.roles.includes('responder') && (
                          <Badge variant="outline">Employee</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant={user.roles.includes('admin') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleAdmin(user.user_id, user.roles)}
                          title={user.roles.includes('admin') ? 'Remove admin role' : 'Make admin'}
                        >
                          {user.roles.includes('admin') ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">Admin</span>
                        </Button>
                        <Button
                          variant={user.roles.includes('responder') ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleResponder(user.user_id, user.roles)}
                          title={user.roles.includes('responder') ? 'Remove responder role' : 'Make responder'}
                        >
                          {user.roles.includes('responder') ? (
                            <ShieldX className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">Responder</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUserToDelete(user)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Stats */}
        <div className="flex gap-4 pt-4 border-t text-sm text-muted-foreground">
          <span>Total: {users.length} users</span>
          <span>Admins: {users.filter(u => u.roles.includes('admin')).length}</span>
          <span>Responders: {users.filter(u => u.roles.includes('responder')).length}</span>
        </div>
      </CardContent>
    </Card>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete User
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{userToDelete?.full_name || userToDelete?.email}</strong>? 
            This action cannot be undone. All their data including questions, answers, and votes will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteUser}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete User"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
