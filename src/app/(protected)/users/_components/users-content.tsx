"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Users, UserPlus, Pencil, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { getUsers, toggleUserRole, updateUser } from "@/lib/actions/users";
import {
  PLATFORM_ROLE_STYLES,
  PLATFORM_ROLE_OPTIONS,
} from "@/lib/constants/roles";
import { CustomSelect } from "@/components/ui/custom-select";
import type { CurrentUser } from "@/lib/auth";

interface UsersContentProps {
  currentUser: CurrentUser;
}

export function UsersContent({ currentUser }: UsersContentProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getUsers().then((result) => {
      if (result.success) setUsers(result.data as any[]);
      setLoading(false);
    });
  }, []);

  function handleRoleChange(userId: string, newRole: string) {
    startTransition(async () => {
      const result = await toggleUserRole(userId, newRole);
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, platformRole: newRole } : u))
        );
        toast.success("Role atualizado");
      } else {
        toast.error(result.error || "Erro ao atualizar role");
      }
    });
  }

  function handleToggleActive(userId: string, isActive: boolean) {
    startTransition(async () => {
      const result = await updateUser(userId, { isActive });
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isActive } : u))
        );
      } else {
        toast.error(result.error || "Erro ao atualizar status");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 border border-violet-600/20">
            <Users className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Usuários</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os usuários da plataforma
            </p>
          </div>
        </div>
        {currentUser.isSuperAdmin && (
          <Button
            size="sm"
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-[0_0_16px_rgba(124,58,237,0.3)] transition-all"
          >
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      {/* Tabela */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      >
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Carregando...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const roleStyle = PLATFORM_ROLE_STYLES[user.platformRole];
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold overflow-hidden">
                              {user.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                user.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-medium text-foreground">
                              {user.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          {currentUser.isSuperAdmin && user.id !== currentUser.id ? (
                            <CustomSelect
                              value={user.platformRole}
                              onChange={(v) => handleRoleChange(user.id, v)}
                              options={PLATFORM_ROLE_OPTIONS}
                              className="w-40"
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${roleStyle?.className ?? ""}`}
                            >
                              {roleStyle?.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={(checked) =>
                              handleToggleActive(user.id, checked)
                            }
                            disabled={user.id === currentUser.id}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {currentUser.isSuperAdmin && user.id !== currentUser.id && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
